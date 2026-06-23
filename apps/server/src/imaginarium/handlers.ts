/**
 * Socket-хендлеры Imaginarium на namespace /imaginarium. Авторитарный сервер:
 * клиент шлёт намерения (room:*, game:leader/submit/vote/advance), сервер
 * валидирует и рассылает виды. Фазные таймеры планируются менеджером и
 * броадкастят сами (onTimeout) — поэтому менеджер получает broadcast-колбэк.
 */
import type { Namespace } from 'socket.io';
import type {
  ImaginariumClientToServerEvents,
  ImaginariumServerToClientEvents,
} from '@boardgames/shared';
import { RoomError, RoomManager } from './manager';
import type { Room } from './manager';
import { resolveIdentity } from '../auth/identity';
import type { Janitable } from '../janitor';
import { createChatThrottle } from '../chatThrottle';
import {
  associationSchema,
  chatTextSchema,
  imaginariumCardIdSchema,
  imaginariumColorSchema,
  imaginariumSettingsPatchSchema,
  imaginariumVoteSlotSchema,
  parseSocketArg,
} from '../validation';

interface SocketData {
  roomCode?: string;
  playerId?: string;
  /** id авторизованного пользователя (из JWT handshake); undefined у гостей. */
  userId?: string;
}

type ImaginariumNamespace = Namespace<
  ImaginariumClientToServerEvents,
  ImaginariumServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export function registerImaginarium(nsp: ImaginariumNamespace): Janitable {
  // broadcast вызывается и менеджером (срабатывания фазных таймеров), и хендлерами.
  const manager = new RoomManager((room) => broadcast(room));
  // Анти-флуд чата: не чаще 5 сообщений за 5с на сокет (аудит безопасности).
  const chatThrottle = createChatThrottle();
  /** Комнаты, для которых финал уже записан (анти-дубль). */
  const recorded = new Set<string>();

  /** Пишет результат партии в БД для всех авторизованных игроков. */
  async function recordFinish(room: Room): Promise<void> {
    const game = room.game;
    if (!process.env.DATABASE_URL || !game || !game.winner || game.winner.length === 0) return;
    // Дедуп по userId: 2 вкладки одного юзера → 1 запись. Победа, если игрок в winner[].
    const byUser = new Map<string, { userId: string; won: boolean; score: number }>();
    for (const [, socket] of nsp.sockets) {
      const d = socket.data;
      if (d.roomCode !== room.code || !d.playerId || !d.userId) continue;
      if (!game.players.includes(d.playerId)) continue;
      const won = game.winner.includes(d.playerId);
      const score = game.scores[d.playerId] ?? 0;
      const existing = byUser.get(d.userId);
      if (existing && existing.won) continue; // уже зафиксировали победу — не перезаписываем
      byUser.set(d.userId, { userId: d.userId, won, score });
    }
    const recipients = [...byUser.values()];
    if (recipients.length === 0) return;
    try {
      const { recordGameResult } = await import('@boardgames/db');
      await Promise.all(
        recipients.map((r) =>
          recordGameResult({ game: 'imaginarium', userId: r.userId, won: r.won, score: r.score }),
        ),
      );
    } catch (e) {
      console.error('recordGameResult failed', e);
    }
  }

  /** Рассылает состояние комнаты, персональные виды игры и дедлайн фазы. */
  function broadcast(room: Room): void {
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
    // Record-finish анти-дубль: на переходе в finished — записываем один раз.
    if (!recorded.has(room.code) && room.phase === 'finished' && room.game?.phase === 'finished') {
      recorded.add(room.code);
      void recordFinish(room);
    }
  }

  nsp.on('connection', (socket) => {
    const data = socket.data;
    const inRoom = (): Room | undefined => (data.roomCode ? manager.get(data.roomCode) : undefined);

    const guard = (fn: () => void): void => {
      try {
        fn();
      } catch (e) {
        socket.emit('game:error', e instanceof RoomError ? e.message : 'Внутренняя ошибка');
        if (!(e instanceof RoomError)) console.error(e);
      }
    };

    /** Готовит room и регистрирует сокет после create/join/rejoin. */
    const bind = async (room: Room, playerId: string): Promise<void> => {
      data.roomCode = room.code;
      data.playerId = playerId;
      await socket.join(room.code);
      socket.emit('chat:history', room.chat);
      broadcast(room);
    };

    socket.on('room:create', (nickname, settings, ack) => {
      void (async () => {
        try {
          const cleanSettings = parseSocketArg(socket, imaginariumSettingsPatchSchema, settings);
          if (cleanSettings === null) return ack({ ok: false, error: 'Некорректные настройки' });
          const id = await resolveIdentity(data.userId);
          const { room, player } = manager.createRoom(
            id.nickname ?? nickname,
            cleanSettings,
            id.avatarUrl,
          );
          await bind(room, player.id);
          ack({
            ok: true,
            room: manager.roomView(room),
            playerId: player.id,
            token: player.token,
          });
        } catch (e) {
          ack({ ok: false, error: e instanceof RoomError ? e.message : 'Внутренняя ошибка' });
        }
      })();
    });

    socket.on('room:join', (code, nickname, ack) => {
      void (async () => {
        try {
          const id = await resolveIdentity(data.userId);
          const { room, player } = manager.joinRoom(code, id.nickname ?? nickname, id.avatarUrl);
          await bind(room, player.id);
          ack({
            ok: true,
            room: manager.roomView(room),
            playerId: player.id,
            token: player.token,
          });
        } catch (e) {
          ack({ ok: false, error: e instanceof RoomError ? e.message : 'Внутренняя ошибка' });
        }
      })();
    });

    socket.on('room:rejoin', async (code, token, ack) => {
      try {
        const { room, player } = manager.rejoin(code, token);
        await bind(room, player.id);
        ack({
          ok: true,
          room: manager.roomView(room),
          playerId: player.id,
          token: player.token,
        });
      } catch (e) {
        ack({ ok: false, error: e instanceof RoomError ? e.message : 'Внутренняя ошибка' });
      }
    });

    const leaveCurrent = async (): Promise<void> => {
      const room = inRoom();
      if (!room || !data.playerId) return;
      const removed = manager.leave(room, data.playerId);
      await socket.leave(room.code);
      data.roomCode = undefined;
      data.playerId = undefined;
      // manager.leave сам чистит таймер при удалении комнаты; иначе — броадкаст.
      if (!removed) broadcast(room);
    };

    socket.on('room:leave', leaveCurrent);
    socket.on('disconnect', leaveCurrent);
    socket.on('disconnect', () => chatThrottle.forget(socket.id));

    socket.on('room:settings', (settings) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const clean = parseSocketArg(socket, imaginariumSettingsPatchSchema, settings);
        if (clean === null) return;
        manager.updateSettings(room, data.playerId, clean);
        broadcast(room);
      }),
    );

    socket.on('room:start', () =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        manager.start(room, data.playerId);
        broadcast(room);
      }),
    );

    socket.on('room:setColor', (color) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const clean = parseSocketArg(socket, imaginariumColorSchema, color);
        if (clean === null) return;
        manager.setPlayerColor(room, data.playerId, clean);
        broadcast(room);
      }),
    );

    socket.on('room:newRound', () =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        manager.newRound(room, data.playerId);
        recorded.delete(room.code); // сброс анти-дубля для новой партии
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
        const msg = manager.addChat(room, data.playerId, clean);
        nsp.to(room.code).emit('chat:message', msg);
      }),
    );

    socket.on('game:leader', (cardId, association) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const cleanCard = parseSocketArg(socket, imaginariumCardIdSchema, cardId);
        if (cleanCard === null) return;
        const cleanAssoc = parseSocketArg(socket, associationSchema, association);
        if (cleanAssoc === null) return;
        manager.submitLeader(room, data.playerId, cleanCard, cleanAssoc);
        broadcast(room);
      }),
    );

    socket.on('game:submit', (cardId) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const clean = parseSocketArg(socket, imaginariumCardIdSchema, cardId);
        if (clean === null) return;
        manager.submitCard(room, data.playerId, clean);
        broadcast(room);
      }),
    );

    socket.on('game:vote', (slot) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const clean = parseSocketArg(socket, imaginariumVoteSlotSchema, slot);
        if (clean === null) return;
        manager.castVote(room, data.playerId, clean);
        broadcast(room);
      }),
    );

    socket.on('game:advance', () =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        manager.advance(room, data.playerId);
        broadcast(room);
      }),
    );
  });

  return {
    cleanupStale: manager.cleanupStale.bind(manager),
    restore: (snapshots) => snapshots.filter((s) => manager.restoreFromSnapshot(s.state)).length,
  };
}
