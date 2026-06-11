import Fastify from 'fastify';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@boardgames/shared';

const PORT = Number(process.env.PORT ?? 3001);

const app = Fastify({ logger: true });

app.get('/health', () => ({ ok: true, ts: Date.now() }));

await app.ready();

const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
  cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' },
});

io.on('connection', (socket) => {
  app.log.info({ id: socket.id }, 'socket connected');
  socket.on('disconnect', () => app.log.info({ id: socket.id }, 'socket disconnected'));
});

await app.listen({ port: PORT, host: '0.0.0.0' });
