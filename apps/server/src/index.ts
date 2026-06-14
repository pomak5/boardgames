/** Bootstrap: Fastify (health) + socket.io с неймспейсами /codenames и /uno. */
import Fastify from 'fastify';
import { Server } from 'socket.io';
import { registerCodenames } from './codenames/handlers';
import { registerUno } from './uno/handlers';
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

registerCodenames(io.of('/codenames') as unknown as Parameters<typeof registerCodenames>[0]);
registerUno(io.of('/uno') as unknown as Parameters<typeof registerUno>[0]);

await app.listen({ port: PORT, host: '0.0.0.0' });
app.log.info(`socket.io namespaces ready: /codenames, /uno (cors: ${WEB_ORIGIN})`);
