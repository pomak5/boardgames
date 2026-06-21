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
/**
 * Простейший in-memory лимитер «N попыток за окно» по ключу (IP+маршрут).
 * Без внешних зависимостей; защищает от брутфорса и спам-регистрации.
 */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const rateHits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  if (rateHits.size > 5000) {
    for (const [k, v] of rateHits) if (now > v.resetAt) rateHits.delete(k);
  }
  const entry = rateHits.get(key);
  if (!entry || now > entry.resetAt) {
    rateHits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<string[]> {
  app.post('/auth/register', async (req, reply) => {
    if (rateLimited(`register:${req.ip}`))
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
    if (rateLimited(`login:${req.ip}`))
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
  app.post('/auth/logout', async (_req, reply) => {
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
