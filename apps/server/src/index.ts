import Fastify from 'fastify';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@boardgames/shared';
import { RoomError, RoomManager } from './rooms';
import type { Room } from './rooms';

const PORT = Number(process.env.PORT ?? 3001);
const BOT_DELAY_MS = Number(process.env.BOT_DELAY_MS ?? 1200);

const app = Fastify({ logger: true });
app.get('/health', () => ({ ok: true, ts: Date.now() }));
await app.ready();

const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
  cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' },
});

const manager = new RoomManager();

/** Рассылает состояние комнаты и персональные виды игры. */
function broadcast(room: Room): void {
  const view = manager.roomView(room);
  for (const [, socket] of io.of('/').sockets) {
    const data = socket.data as SocketData;
    if (data.roomCode !== room.code || !data.playerId) continue;
    socket.emit('room:state', view);
    const gameView = manager.viewFor(room, data.playerId);
    if (gameView) socket.emit('game:state', gameView);
  }
}

/** Если у текущей команды бот-капитан — даёт подсказку с небольшой задержкой. */
function scheduleBot(room: Room): void {
  if (!room.game || room.game.phase !== 'clue') return;
  if (!room.settings.botCaptains[room.game.turn] || room.botPending) return;
  room.botPending = true;
  const expectedTurn = room.game.turn;
  setTimeout(() => {
    room.botPending = false;
    if (!manager.get(room.code) || room.game?.turn !== expectedTurn) return;
    if (manager.botClue(room)) broadcast(room);
  }, BOT_DELAY_MS);
}

interface SocketData {
  roomCode?: string;
  playerId?: string;
}

io.on('connection', (socket) => {
  const data = socket.data as SocketData;

  const inRoom = (): Room | undefined => (data.roomCode ? manager.get(data.roomCode) : undefined);

  const guard = (fn: () => void): void => {
    try {
      fn();
    } catch (e) {
      socket.emit('game:error', e instanceof RoomError ? e.message : 'Внутренняя ошибка');
      if (!(e instanceof RoomError)) app.log.error(e);
    }
  };

  socket.on('room:create', (nickname, settings, ack) => {
    try {
      const { room, player } = manager.createRoom(nickname, settings);
      data.roomCode = room.code;
      data.playerId = player.id;
      void socket.join(room.code);
      ack({ ok: true, room: manager.roomView(room), playerId: player.id, token: player.token });
    } catch (e) {
      ack({ ok: false, error: e instanceof RoomError ? e.message : 'Внутренняя ошибка' });
    }
  });

  socket.on('room:join', (code, nickname, ack) => {
    try {
      const { room, player } = manager.joinRoom(code, nickname);
      data.roomCode = room.code;
      data.playerId = player.id;
      void socket.join(room.code);
      ack({ ok: true, room: manager.roomView(room), playerId: player.id, token: player.token });
      socket.emit('chat:history', room.chat);
      broadcast(room);
    } catch (e) {
      ack({ ok: false, error: e instanceof RoomError ? e.message : 'Внутренняя ошибка' });
    }
  });

  socket.on('room:rejoin', (code, token, ack) => {
    try {
      const { room, player } = manager.rejoin(code, token);
      data.roomCode = room.code;
      data.playerId = player.id;
      void socket.join(room.code);
      ack({ ok: true, room: manager.roomView(room), playerId: player.id, token: player.token });
      socket.emit('chat:history', room.chat);
      broadcast(room);
    } catch (e) {
      ack({ ok: false, error: e instanceof RoomError ? e.message : 'Внутренняя ошибка' });
    }
  });

  const leaveCurrent = (): void => {
    const room = inRoom();
    if (!room || !data.playerId) return;
    const removed = manager.leave(room, data.playerId);
    void socket.leave(room.code);
    data.roomCode = undefined;
    data.playerId = undefined;
    if (!removed) broadcast(room);
  };

  socket.on('room:leave', leaveCurrent);
  socket.on('disconnect', leaveCurrent);

  socket.on('room:setTeam', (team, role) =>
    guard(() => {
      const room = inRoom();
      if (!room || !data.playerId) return;
      manager.setTeam(room, data.playerId, team, role);
      broadcast(room);
    }),
  );

  socket.on('room:settings', (settings) =>
    guard(() => {
      const room = inRoom();
      if (!room || !data.playerId) return;
      manager.updateSettings(room, data.playerId, settings);
      broadcast(room);
    }),
  );

  socket.on('room:start', () =>
    guard(() => {
      const room = inRoom();
      if (!room || !data.playerId) return;
      manager.start(room, data.playerId);
      broadcast(room);
      scheduleBot(room);
    }),
  );

  socket.on('chat:send', (text) =>
    guard(() => {
      const room = inRoom();
      if (!room || !data.playerId) return;
      const msg = manager.addChat(room, data.playerId, text);
      io.to(room.code).emit('chat:message', msg);
    }),
  );

  socket.on('game:clue', (clue) =>
    guard(() => {
      const room = inRoom();
      if (!room || !data.playerId) return;
      manager.giveClue(room, data.playerId, clue);
      broadcast(room);
    }),
  );

  socket.on('game:guess', (cardIndex) =>
    guard(() => {
      const room = inRoom();
      if (!room || !data.playerId) return;
      manager.guess(room, data.playerId, cardIndex);
      broadcast(room);
      scheduleBot(room);
    }),
  );

  socket.on('game:pass', () =>
    guard(() => {
      const room = inRoom();
      if (!room || !data.playerId) return;
      manager.pass(room, data.playerId);
      broadcast(room);
      scheduleBot(room);
    }),
  );
});

await app.listen({ port: PORT, host: '0.0.0.0' });
