/** Socket-хендлеры Uno на namespace /uno. Боты и таймаут планируются менеджером и шлют broadcast. */
import type { Namespace } from 'socket.io';
import type {
  UnoClientToServerEvents,
  UnoServerToClientEvents,
} from '@boardgames/shared';
import { UnoRoomError, UnoRoomManager } from './manager';
import type { UnoRoom } from './manager';

interface SocketData {
  roomCode?: string;
  playerId?: string;
}

type UnoNamespace = Namespace<
  UnoClientToServerEvents,
  UnoServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export function registerUno(nsp: UnoNamespace): void {
  // broadcast вызывается и менеджером (ходы бота/таймаут), и хендлерами (ходы игрока)
  const manager = new UnoRoomManager((room) => broadcast(room));

  function broadcast(room: UnoRoom): void {
    for (const [, socket] of nsp.sockets) {
      const data = socket.data;
      if (data.roomCode !== room.code || !data.playerId) continue;
      socket.emit('room:state', manager.roomView(room));
      const gameView = manager.viewFor(room, data.playerId);
      if (gameView) socket.emit('game:state', gameView);
      socket.emit('game:timer', room.phase === 'playing' ? room.turnDeadline : null);
    }
  }

  nsp.on('connection', (socket) => {
    const data = socket.data;
    const inRoom = (): UnoRoom | undefined =>
      data.roomCode ? manager.get(data.roomCode) : undefined;

    const guard = (fn: () => void): void => {
      try {
        fn();
      } catch (e) {
        socket.emit('game:error', e instanceof UnoRoomError ? e.message : 'Внутренняя ошибка');
        if (!(e instanceof UnoRoomError)) console.error(e);
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
        ack({ ok: false, error: e instanceof UnoRoomError ? e.message : 'Внутренняя ошибка' });
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
        ack({ ok: false, error: e instanceof UnoRoomError ? e.message : 'Внутренняя ошибка' });
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
        ack({ ok: false, error: e instanceof UnoRoomError ? e.message : 'Внутренняя ошибка' });
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

    socket.on('room:settings', (settings) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        manager.updateSettings(room, tokenOf(room, data.playerId), settings);
        broadcast(room);
      }),
    );

    socket.on('room:addBot', () =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        manager.addBot(room, tokenOf(room, data.playerId));
        broadcast(room);
      }),
    );

    socket.on('room:removeBot', (botId) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        manager.removeBot(room, tokenOf(room, data.playerId), botId);
        broadcast(room);
      }),
    );

    socket.on('room:start', () =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        manager.start(room, tokenOf(room, data.playerId));
        broadcast(room);
      }),
    );

    socket.on('room:nextRound', () =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        manager.nextRound(room, tokenOf(room, data.playerId));
        broadcast(room);
      }),
    );

    socket.on('room:newGame', () =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        manager.newGame(room, tokenOf(room, data.playerId));
        broadcast(room);
      }),
    );

    socket.on('game:act', (action) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        manager.act(room, tokenOf(room, data.playerId), action);
        broadcast(room);
      }),
    );

    socket.on('chat:send', (text) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const msg = manager.addChat(room, tokenOf(room, data.playerId), text);
        nsp.to(room.code).emit('chat:message', msg);
      }),
    );
  });

  /** Сокет хранит playerId; менеджер ждёт token. Резолвим token по playerId внутри комнаты. */
  function tokenOf(room: UnoRoom, playerId: string): string {
    const p = room.players.find((pl) => pl.id === playerId);
    if (!p) throw new UnoRoomError('Игрок не найден');
    return p.token;
  }
}
