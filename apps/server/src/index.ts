/** Bootstrap: Fastify (health) + socket.io. Неймспейсы игр берутся из реестра `games`. */
import Fastify from 'fastify';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, type RedisClientType } from 'redis';
import { games } from './games';
import { attachUser } from './auth/socket';
import { mapPrismaError } from './auth/prismaErrors';
import { startJanitor } from './janitor';
import type { Janitable } from './janitor';
import { persistAvailable, closePersist, loadAllRooms } from './persist';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';

const PORT = Number(process.env.PORT ?? 3001);
const WEB_ORIGIN_DEFAULT = 'http://localhost:5173';
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? WEB_ORIGIN_DEFAULT;
const allowedOrigins = WEB_ORIGIN.split(',').map((o) => o.trim());

const app = Fastify({ logger: true });
if (!process.env.WEB_ORIGIN) {
  app.log.warn(
    `WEB_ORIGIN не задан — CORS по умолчанию ${WEB_ORIGIN_DEFAULT}. На проде задайте origin(s) через запятую.`,
  );
}
await app.register(cors, { origin: allowedOrigins });
// HttpOnly-кука с JWT (auth-migration). secret переиспользуем из JWT_SECRET —
// нужен только для подписанных кук; сейчас кука не подписана (JWT самоверифицируется),
// но секрет доступен для будущего использования. Регистрируем до auth-роутов,
// чтобы req.cookies и reply.setCookie были доступны в routes.ts.
await app.register(cookie, { secret: process.env.JWT_SECRET });
// Единый обработчик ошибок: Prisma-коды → аккуратный 4xx, прочее → чистый 500 без стека.
app.setErrorHandler((err, _req, reply) => {
  const mapped = mapPrismaError(err);
  if (mapped) {
    reply.code(mapped.status).send({ error: mapped.error });
    return;
  }
  app.log.error(err);
  reply.code(500).send({ error: 'Внутренняя ошибка сервера' });
});
app.get('/health', () => ({ ok: true, ts: Date.now() }));

// Leaderboard refresh job (аудит §6): periodic REFRESH MATERIALIZED VIEW.
// Стартует только под DATABASE_URL (lazy import Prisma); см. leaderboard-refresh.ts.
let stopLeaderboardRefresh: (() => void) | undefined;

if (process.env.DATABASE_URL) {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET обязателен при заданном DATABASE_URL (включён auth). Задайте длинную случайную строку.',
    );
  }
  const { registerAuthRoutes } = await import('./auth/routes');
  const authPaths = await registerAuthRoutes(app);
  app.log.info(`auth routes mounted: ${authPaths.join(', ')}`);
  const { startLeaderboardRefresh } = await import('./leaderboard-refresh');
  stopLeaderboardRefresh = startLeaderboardRefresh(app.log);
} else {
  app.log.info('DATABASE_URL not set — guest-only mode, auth disabled');
}
await app.ready();

const io = new Server(app.server, {
  cors: { origin: allowedOrigins },
});

// Redis-адаптер для multi-node broadcast (аудит §10). Env-gated: без REDIS_URL —
// in-memory adapter (single-node). pub/sub clients для межнодного broadcast.
let redisClients: { pub: RedisClientType; sub: RedisClientType } | null = null;
if (process.env.REDIS_URL) {
  const pubClient = createClient({ url: process.env.REDIS_URL }) as RedisClientType;
  const subClient = pubClient.duplicate() as RedisClientType;
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  redisClients = { pub: pubClient, sub: subClient };
  app.log.info(`redis adapter attached: ${process.env.REDIS_URL}`);
} else {
  app.log.info('REDIS_URL not set — single-node in-memory adapter');
}

// Регистрируем игры и собираем Janitable-хендлы для фоновой чистки зомби-комнат.
const janitorGames: { namespace: string; name: string; janitor?: Janitable }[] = [];
for (const game of games) {
  const nsp = io.of(game.namespace);
  nsp.use(attachUser);
  const janitor = game.register(nsp);
  janitorGames.push({ namespace: game.namespace, name: game.name, janitor: janitor ?? undefined });
}

// Persist restore-on-startup (аудит §1). Загружаем снапшоты комнат из Redis и
// восстанавливаем их в менеджерах. Флаг PERSIST_RESTORE=true включает restore;
// без него комнаты остаются RAM-only (как раньше). Restore переоружает таймеры
// (Uno: afterUpdate, Alias: armRoundTimer, Codenames: при следующем действии).
if (process.env.PERSIST_RESTORE === 'true' && persistAvailable()) {
  const prefixMap: Record<string, 'codenames' | 'uno' | 'alias'> = {
    '/codenames': 'codenames',
    '/uno': 'uno',
    '/alias': 'alias',
  };
  for (const g of janitorGames) {
    if (!g.janitor?.restore) continue;
    const prefix = prefixMap[g.namespace];
    if (!prefix) continue;
    try {
      const snapshots = await loadAllRooms(prefix);
      if (snapshots.length === 0) continue;
      const restored = g.janitor.restore(snapshots);
      app.log.info(
        `persist restore[${g.name}]: ${restored}/${snapshots.length} rooms loaded from Redis`,
      );
    } catch (e) {
      app.log.warn(`persist restore[${g.name}] failed: ${(e as Error).message}`);
    }
  }
} else if (process.env.PERSIST_RESTORE === 'true') {
  app.log.warn('PERSIST_RESTORE enabled but REDIS_URL not set — restore skipped');
}

// Janitor (аудит §4): раз в минуту удаляет комнаты без живых сокетов;
// playing-комнаты — с grace по turnDeadline. См. janitor.ts.
const stopJanitor = startJanitor(janitorGames, (ns) => io.of(ns), app.log);

await app.listen({ port: PORT, host: '0.0.0.0' });
app.log.info(
  `socket.io namespaces ready: ${games.map((g) => g.namespace).join(', ')} (cors: ${WEB_ORIGIN})`,
);

// Graceful shutdown: останавливаем janitor, закрываем сервер и redis-клиенты.
// В проде (docker compose) это позволяет чисто завершаться без «зависших»
// таймеров janitor'а и redis-соединений между деплоями.
const shutdown = async (sig: string): Promise<void> => {
  app.log.info(`${sig} received — shutting down`);
  stopJanitor();
  stopLeaderboardRefresh?.();
  await app.close();
  io.close();
  if (redisClients) {
    await redisClients.pub.quit();
    await redisClients.sub.quit();
  }
  await closePersist();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
