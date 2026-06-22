/**
 * Socket-хендлеры Alias на namespace /alias. Авторитарный сервер: клиент шлёт
 * намерения (room:*, game:guessed/skipped), сервер валидирует и рассылает виды.
 */
import type { Namespace } from 'socket.io';
import type {
  AliasClientToServerEvents,
  AliasServerToClientEvents,
  Team,
} from '@boardgames/shared';
import { RoomError, RoomManager } from './manager';
import type { Room } from './manager';
import { resolveIdentity } from '../auth/identity';
import type { Janitable } from '../janitor';
import { aliasSettingsPatchSchema, chatTextSchema, parseSocketArg } from '../validation';

interface SocketData {
  roomCode?: string;
  playerId?: string;
  /** id авторизованного пользователя (из JWT handshake); undefined у гостей. */
  userId?: string;
}

type AliasNamespace = Namespace<
  AliasClientToServerEvents,
  AliasServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export function registerAlias(nsp: AliasNamespace): Janitable {
  const manager = new RoomManager();

  /** Рассылает состояние комнаты, персональные виды игры и дедлайн раунда. */
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
  }

  /** Пишет результат партии в БД для авторизованных игроков комнаты. */
  async function recordFinish(room: Room): Promise<void> {
    const game = room.game;
    if (!process.env.DATABASE_URL || !game || game.winner == null) return;
    const winner = game.winner;
    const byUser = new Map<string, { userId: string; team: Team }>();
    for (const [, socket] of nsp.sockets) {
      const d = socket.data;
      if (d.roomCode !== room.code || !d.playerId || !d.userId) continue;
      if (byUser.has(d.userId)) continue;
      const player = room.players.get(d.playerId);
      if (!player || !player.team) continue;
      byUser.set(d.userId, { userId: d.userId, team: player.team });
    }
    const recipients = [...byUser.values()];
    if (recipients.length === 0) return;
    try {
      const { recordGameResult } = await import('@boardgames/db');
      await Promise.all(
        recipients.map((r) =>
          recordGameResult({
            game: 'alias',
            userId: r.userId,
            won: r.team === winner,
            team: r.team,
          }),
        ),
      );
    } catch (e) {
      console.error('recordGameResult failed', e);
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
          const cleanSettings = parseSocketArg(socket, aliasSettingsPatchSchema, settings);
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
      if (removed) {
        if (room.timer) clearTimeout(room.timer);
      } else {
        broadcast(room);
      }
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
        const clean = parseSocketArg(socket, aliasSettingsPatchSchema, settings);
        if (clean === null) return;
        manager.updateSettings(room, data.playerId, clean);
        broadcast(room);
      }),
    );

    socket.on(
      'room:start',
      () =>
        void (async () => {
          try {
            const room = inRoom();
            if (!room || !data.playerId) return;
            await manager.start(room, data.playerId);
            broadcast(room);
          } catch (e) {
            socket.emit('game:error', e instanceof RoomError ? e.message : 'Внутренняя ошибка');
            if (!(e instanceof RoomError)) console.error(e);
          }
        })(),
    );

    socket.on(
      'room:newRound',
      () =>
        void (async () => {
          try {
            const room = inRoom();
            if (!room || !data.playerId) return;
            await manager.newRound(room, data.playerId);
            broadcast(room);
          } catch (e) {
            socket.emit('game:error', e instanceof RoomError ? e.message : 'Внутренняя ошибка');
            if (!(e instanceof RoomError)) console.error(e);
          }
        })(),
    );

    socket.on('chat:send', (text) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const clean = parseSocketArg(socket, chatTextSchema, text);
        if (clean === null) return;
        const msg = manager.addChat(room, data.playerId, clean);
        nsp.to(room.code).emit('chat:message', msg);
      }),
    );

    socket.on('game:guessed', () =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const wasFinished = room.game?.phase === 'finished';
        manager.markGuessed(room, data.playerId);
        broadcast(room);
        if (!wasFinished && room.game?.phase === 'finished') void recordFinish(room);
      }),
    );

    socket.on('game:skipped', () =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const wasFinished = room.game?.phase === 'finished';
        manager.markSkipped(room, data.playerId);
        broadcast(room);
        if (!wasFinished && room.game?.phase === 'finished') void recordFinish(room);
      }),
    );
  });
  return {
    cleanupStale: manager.cleanupStale.bind(manager),
    restore: (snapshots) => snapshots.filter((s) => manager.restoreFromSnapshot(s.state)).length,
  };
}
