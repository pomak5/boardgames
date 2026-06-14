/** Bootstrap: Fastify (health) + socket.io. Неймспейсы игр берутся из реестра `games`. */
import Fastify from 'fastify';
import { Server } from 'socket.io';
import { games } from './games';
import cors from '@fastify/cors';

const PORT = Number(process.env.PORT ?? 3001);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

const app = Fastify({ logger: true });
await app.register(cors, { origin: WEB_ORIGIN });
app.get('/health', () => ({ ok: true, ts: Date.now() }));

if (process.env.DATABASE_URL) {
  const { registerAuthRoutes } = await import('./auth/routes');
  await registerAuthRoutes(app);
  app.log.info('auth routes mounted: /auth/register, /auth/login, /auth/me');
} else {
  app.log.info('DATABASE_URL not set — guest-only mode, auth disabled');
}
await app.ready();

const io = new Server(app.server, {
  cors: { origin: WEB_ORIGIN },
});

for (const game of games) {
  game.register(io.of(game.namespace));
}

await app.listen({ port: PORT, host: '0.0.0.0' });
app.log.info(
  `socket.io namespaces ready: ${games.map((g) => g.namespace).join(', ')} (cors: ${WEB_ORIGIN})`,
);
