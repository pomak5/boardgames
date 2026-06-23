/** Socket-хендлеры Uno на namespace /uno. Боты и таймаут планируются менеджером и шлют broadcast. */
import type { Namespace } from 'socket.io';
import type { UnoClientToServerEvents, UnoServerToClientEvents } from '@boardgames/shared';
import { UnoRoomError, UnoRoomManager } from './manager';
import type { UnoRoom } from './manager';
import { resolveIdentity } from '../auth/identity';
import type { Janitable } from '../janitor';
import { createChatThrottle } from '../chatThrottle';
import {
  chatTextSchema,
  parseSocketArg,
  unoActionSchema,
  unoSettingsPatchSchema,
} from '../validation';

interface SocketData {
  roomCode?: string;
  playerId?: string;
  /** id авторизованного пользователя (из JWT handshake); undefined у гостей. */
  userId?: string;
}

type UnoNamespace = Namespace<
  UnoClientToServerEvents,
  UnoServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export function registerUno(nsp: UnoNamespace): Janitable {
  // broadcast вызывается и менеджером (ходы бота/таймаут), и хендлерами (ходы игрока)
  const manager = new UnoRoomManager((room) => broadcast(room));
  // Анти-флуд чата: не чаще 5 сообщений за 5с на сокет (аудит безопасности).
  const chatThrottle = createChatThrottle();
  /** Комнаты, для которых финал уже записан (анти-дубль). */
  const recorded = new Set<string>();

  /** Пишет результат матча в БД для всех авторизованных игроков. */
  async function recordFinish(room: UnoRoom): Promise<void> {
    const game = room.game;
    if (!process.env.DATABASE_URL || !game || !game.winner) return;
    // Дедуп по userId: 2 вкладки одного юзера → 1 запись. Победа засчитывается,
    // если хоть один из его playerId === game.winner (счёт берём по победителю).
    const byUser = new Map<string, { userId: string; won: boolean; score: number }>();
    for (const [, socket] of nsp.sockets) {
      const d = socket.data;
      if (d.roomCode !== room.code || !d.playerId || !d.userId) continue;
      const p = game.players.find((pl) => pl.id === d.playerId);
      if (!p) continue;
      const won = game.winner === d.playerId;
      const existing = byUser.get(d.userId);
      if (existing && existing.won) continue; // уже зафиксировали победу — не перезаписываем
      byUser.set(d.userId, { userId: d.userId, won, score: p.score });
    }
    const recipients = [...byUser.values()];
    if (recipients.length === 0) return;
    try {
      const { recordGameResult } = await import('@boardgames/db');
      await Promise.all(
        recipients.map((r) =>
          recordGameResult({ game: 'uno', userId: r.userId, won: r.won, score: r.score }),
        ),
      );
    } catch (e) {
      console.error('recordGameResult failed', e);
    }
  }

  function broadcast(room: UnoRoom): void {
    // Итерируем только сокеты комнаты (adapter.rooms, O(room)) вместо всех сокетов
    // неймспейса (O(all)) — аудит §10. adapter.rooms наполняется socket.join(room.code)
    // в create/join/rejoin и чистится на leave/disconnect — sync на single-node.
    const roomSocketIds = nsp.adapter.rooms.get(room.code);
    if (roomSocketIds) {
      for (const id of roomSocketIds) {
        const socket = nsp.sockets.get(id);
        if (!socket) continue;
        const data = socket.data;
        if (!data.playerId) continue;
        socket.emit('room:state', manager.roomView(room));
        const gameView = manager.viewFor(room, data.playerId);
        if (gameView) socket.emit('game:state', gameView);
        socket.emit('game:timer', room.phase === 'playing' ? room.turnDeadline : null);
      }
    }
    if (room.phase === 'finished' && room.game?.winner) {
      if (!recorded.has(room.code)) {
        recorded.add(room.code);
        void recordFinish(room);
      }
    } else {
      recorded.delete(room.code);
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
      void (async () => {
        try {
          const cleanSettings = parseSocketArg(socket, unoSettingsPatchSchema, settings);
          if (cleanSettings === null) return ack({ ok: false, error: 'Некорректные настройки' });
          const id = await resolveIdentity(data.userId);
          const { room, player } = manager.createRoom(
            id.nickname ?? nickname,
            cleanSettings,
            id.avatarUrl,
          );
          data.roomCode = room.code;
          data.playerId = player.id;
          await socket.join(room.code);
          ack({ ok: true, room: manager.roomView(room), playerId: player.id, token: player.token });
        } catch (e) {
          ack({ ok: false, error: e instanceof UnoRoomError ? e.message : 'Внутренняя ошибка' });
        }
      })();
    });

    socket.on('room:join', (code, nickname, ack) => {
      void (async () => {
        try {
          const id = await resolveIdentity(data.userId);
          const { room, player } = manager.joinRoom(code, id.nickname ?? nickname, id.avatarUrl);
          data.roomCode = room.code;
          data.playerId = player.id;
          await socket.join(room.code);
          ack({ ok: true, room: manager.roomView(room), playerId: player.id, token: player.token });
          socket.emit('chat:history', room.chat);
          broadcast(room);
        } catch (e) {
          ack({ ok: false, error: e instanceof UnoRoomError ? e.message : 'Внутренняя ошибка' });
        }
      })();
    });

    socket.on('room:rejoin', async (code, token, ack) => {
      try {
        const { room, player } = manager.rejoin(code, token);
        data.roomCode = room.code;
        data.playerId = player.id;
        await socket.join(room.code);
        ack({ ok: true, room: manager.roomView(room), playerId: player.id, token: player.token });
        socket.emit('chat:history', room.chat);
        broadcast(room);
      } catch (e) {
        ack({ ok: false, error: e instanceof UnoRoomError ? e.message : 'Внутренняя ошибка' });
      }
    });

    const leaveCurrent = async (): Promise<void> => {
      const room = inRoom();
      if (!room || !data.playerId) return;
      const removed = manager.leave(room, data.playerId);
      await socket.leave(room.code);
      data.roomCode = undefined;
      data.playerId = undefined;
      if (!removed) broadcast(room);
    };

    socket.on('room:leave', leaveCurrent);
    socket.on('disconnect', leaveCurrent);
    socket.on('disconnect', () => chatThrottle.forget(socket.id));

    socket.on('room:settings', (settings) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const clean = parseSocketArg(socket, unoSettingsPatchSchema, settings);
        if (clean === null) return;
        manager.updateSettings(room, tokenOf(room, data.playerId), clean);
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
        const clean = parseSocketArg(socket, unoActionSchema, action);
        if (clean === null) return;
        manager.act(room, tokenOf(room, data.playerId), clean);
        broadcast(room);
      }),
    );

    socket.on('chat:send', (text) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const clean = parseSocketArg(socket, chatTextSchema, text);
        if (clean === null) return;
        if (!chatThrottle.allow(socket.id)) return;
        const msg = manager.addChat(room, tokenOf(room, data.playerId), clean);
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
  return {
    cleanupStale: manager.cleanupStale.bind(manager),
    restore: (snapshots) => snapshots.filter((s) => manager.restoreFromSnapshot(s.state)).length,
  };
}
