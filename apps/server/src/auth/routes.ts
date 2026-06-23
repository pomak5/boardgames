/** REST-роуты аккаунтов. Подключаются только при заданном DATABASE_URL. */
import type { FastifyInstance } from 'fastify';
import {
  createUser,
  findUserByEmail,
  getLeaderboard,
  getRecentResults,
  getUserById,
  getUserStats,
  updateUserAvatar,
} from '@boardgames/db';
import { hashPassword, verifyPassword } from './password';
import { AUTH_COOKIE_NAME, authCookieOptions, payloadFromRequest, signToken } from './jwt';
import { mapPrismaError } from './prismaErrors';
import { AvatarSchema, LoginSchema, RegisterSchema } from './schemas';
import { deleteAvatar, extFromAvatarUrl, storageAvailable, uploadAvatar } from '../storage';
import { originAllowed, parseAllowedOrigins } from './origin';
import { createRateLimiter, type RedisLike } from '../rateLimit';
import { createClient, type RedisClientType } from 'redis';
/**
 * Лимитер «N попыток за окно» по ключу (IP+маршрут) — защита от брутфорса и
 * спам-регистрации. При заданном REDIS_URL счётчик общий для всех инстансов
 * (multi-node), иначе in-memory (single-node/dev). См. ../rateLimit.ts.
 */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

/** Лениво подключаемый redis-клиент в виде RedisLike для лимитера. */
function redisLikeFactory(log: { warn: (m: string) => void }) {
  return (url: string): RedisLike => {
    const client = createClient({ url }) as RedisClientType;
    client.on('error', (e) => log.warn(`rate-limit redis: ${(e as Error).message}`));
    let connected = false;
    const ensure = async (): Promise<void> => {
      if (!connected) {
        await client.connect();
        connected = true;
      }
    };
    return {
      incr: async (k) => {
        await ensure();
        return client.incr(k);
      },
      pExpire: async (k, ms) => {
        await ensure();
        return client.pExpire(k, ms);
      },
    };
  };
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<string[]> {
  // Rate-limiter: Redis при REDIS_URL (общий счётчик), иначе in-memory.
  const limiter = createRateLimiter(RATE_LIMIT, RATE_WINDOW_MS, {
    log: app.log,
    connectRedis: redisLikeFactory(app.log),
  });
  // Origin-CSRF: разрешённые источники для state-changing запросов (аудит).
  const allowedOrigins = parseAllowedOrigins(process.env.WEB_ORIGIN);
  const hdr = (v: string | string[] | undefined): string | undefined =>
    typeof v === 'string' ? v : undefined;
  /** true — источник разрешён; иначе шлёт 403 и возвращает false. */
  const csrfOk = (
    req: { headers: { origin?: string | string[]; referer?: string | string[] } },
    reply: { code: (n: number) => { send: (b: unknown) => unknown } },
  ): boolean => {
    if (originAllowed(hdr(req.headers.origin), hdr(req.headers.referer), allowedOrigins))
      return true;
    reply.code(403).send({ error: 'Запрещённый источник запроса' });
    return false;
  };

  app.post('/auth/register', async (req, reply) => {
    if (!csrfOk(req, reply)) return;
    if (await limiter.limited(`register:${req.ip}`))
      return reply.code(429).send({ error: 'Слишком много попыток, попробуйте позже' });
    const body = req.body ?? {};
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      // Сохраняем прежний UX: отсутствие любого поля → общее сообщение, иначе —
      // первое сообщение схемы (напр. «Пароль минимум 6 символов»). zod-слой сверх
      // того ловит malformed-полезную нагрузку (число вместо строки, массив).
      const { email, nickname, password } = body as Record<string, unknown>;
      if (!email || !nickname || !password)
        return reply.code(400).send({ error: 'email, nickname и password обязательны' });
      const pwdIssue = parsed.error.issues.find((i) => i.path[0] === 'password');
      return reply.code(400).send({ error: pwdIssue?.message ?? 'Некорректные данные' });
    }
    const { email, nickname, password } = parsed.data;
    if (await findUserByEmail(email)) return reply.code(409).send({ error: 'Email уже занят' });
    let user;
    try {
      user = await createUser(email, nickname, await hashPassword(password));
    } catch (e) {
      // Гонка: между findUserByEmail и createUser конкурентная регистрация успела
      // создать тот же email → Prisma кидает P2002. Отдаём тот же 409, что и выше.
      if (mapPrismaError(e)?.code === 'P2002')
        return reply.code(409).send({ error: 'Email уже занят' });
      throw e;
    }
    const token = await signToken({ userId: user.id, nickname: user.nickname });
    // HttpOnly-кука с JWT (приоритетный путь авторизации). Bearer-токен тоже
    // возвращаем в JSON — клиент пишет его в localStorage как fallback для socket.io.
    reply.setCookie(AUTH_COOKIE_NAME, token, authCookieOptions());
    return reply.code(201).send({ token, user });
  });

  app.post('/auth/login', async (req, reply) => {
    if (!csrfOk(req, reply)) return;
    if (await limiter.limited(`login:${req.ip}`))
      return reply.code(429).send({ error: 'Слишком много попыток, попробуйте позже' });
    const body = req.body ?? {};
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      const { email, password } = body as Record<string, unknown>;
      if (!email || !password)
        return reply.code(400).send({ error: 'email и password обязательны' });
      return reply.code(400).send({ error: 'Некорректные данные' });
    }
    const { email, password } = parsed.data;
    const row = await findUserByEmail(email);
    if (!row || !(await verifyPassword(password, row.passwordHash)))
      return reply.code(401).send({ error: 'Неверный email или пароль' });
    const token = await signToken({ userId: row.id, nickname: row.nickname });
    reply.setCookie(AUTH_COOKIE_NAME, token, authCookieOptions());
    return reply.send({
      token,
      user: {
        id: row.id,
        email: row.email,
        nickname: row.nickname,
        avatarUrl: row.avatarUrl,
        createdAt: row.createdAt,
      },
    });
  });

  app.get('/auth/me', async (req, reply) => {
    // Кука приоритет (HttpOnly, same-origin), Bearer — legacy fallback.
    const payload = await payloadFromRequest(
      req.cookies[AUTH_COOKIE_NAME],
      req.headers.authorization,
    );
    if (!payload) return reply.code(401).send({ error: 'Не авторизован' });
    const user = await getUserById(payload.userId);
    if (!user) return reply.code(404).send({ error: 'Пользователь не найден' });
    const stats = await getUserStats(user.id);
    return reply.send({ user, stats });
  });

  app.post('/auth/avatar', async (req, reply) => {
    if (!csrfOk(req, reply)) return;
    const payload = await payloadFromRequest(
      req.cookies[AUTH_COOKIE_NAME],
      req.headers.authorization,
    );
    if (!payload) return reply.code(401).send({ error: 'Не авторизован' });
    const parsed = AvatarSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      // Слишком большой → 413 (как прежде); прочее (не data:image/, не тот тип) → 400.
      if (issue.code === 'too_big') return reply.code(413).send({ error: issue.message });
      return reply.code(400).send({ error: 'Ожидается data:image/* URL' });
    }
    const dataUrl = parsed.data.avatarUrl ?? null;

    // Storage-режим (S3/MinIO): data-URL → object, в БД — публичный URL.
    // Fallback (storage не настроен): data-URL прямо в БД (старое поведение,
    // для dev без MinIO). При сбросе (null) — удаляем старый object, если был.
    if (storageAvailable() && dataUrl != null) {
      const old = await getUserById(payload.userId);
      const oldUrl = old?.avatarUrl;
      let url: string;
      try {
        url = await uploadAvatar(payload.userId, dataUrl);
      } catch (e) {
        app.log.error({ err: e }, 'avatar upload failed');
        return reply.code(503).send({ error: 'Не удалось сохранить аватар (storage)' });
      }
      const user = await updateUserAvatar(payload.userId, url);
      // Чистим старый object, если он был из storage (URL нашего bucket).
      if (oldUrl && oldUrl !== url) {
        const oldExt = extFromAvatarUrl(oldUrl);
        if (oldExt) void deleteAvatar(payload.userId, oldExt).catch(() => {});
      }
      return reply.send({ user });
    }

    // Сброс аватара (null): если старый был в storage — удаляем object.
    if (dataUrl == null) {
      const old = await getUserById(payload.userId);
      const oldUrl = old?.avatarUrl;
      if (oldUrl && storageAvailable()) {
        const oldExt = extFromAvatarUrl(oldUrl);
        if (oldExt) void deleteAvatar(payload.userId, oldExt).catch(() => {});
      }
      const user = await updateUserAvatar(payload.userId, null);
      return reply.send({ user });
    }

    // Fallback: storage не настроен — data-URL прямо в БД (старый путь).
    const user = await updateUserAvatar(payload.userId, dataUrl);
    return reply.send({ user });
  });

  app.get('/auth/history', async (req, reply) => {
    const payload = await payloadFromRequest(
      req.cookies[AUTH_COOKIE_NAME],
      req.headers.authorization,
    );
    if (!payload) return reply.code(401).send({ error: 'Не авторизован' });
    const results = await getRecentResults(payload.userId, 30);
    return reply.send({ results });
  });

  app.get('/leaderboard', async (_req, reply) => {
    const entries = await getLeaderboard(20);
    return reply.send({ entries });
  });

  // Logout: сбрасываем HttpOnly-куку. Локальный токен (localStorage) чистит клиент.
  app.post('/auth/logout', async (req, reply) => {
    if (!csrfOk(req, reply)) return;
    reply.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
    return reply.send({ ok: true });
  });

  // Список смонтированных путей — источник правды для лога в index.ts.
  // При добавлении роута обновляй и этот список.
  return [
    '/auth/register',
    '/auth/login',
    '/auth/logout',
    '/auth/me',
    '/auth/avatar',
    '/auth/history',
    '/leaderboard',
  ];
}
