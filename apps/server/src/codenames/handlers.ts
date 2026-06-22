/** Socket-хендлеры Коднеймс на namespace /codenames. Авторитарный сервер: клиент шлёт намерения. */
import type { Namespace } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, Team } from '@boardgames/shared';
import { RoomError, RoomManager } from './manager';
import type { Room } from './manager';
import { resolveIdentity } from '../auth/identity';
import type { Janitable } from '../janitor';
import {
  cardIndexSchema,
  chatTextSchema,
  clueSchema,
  codenamesSettingsSchema,
  parseSocketArg,
  setCaptainArgsSchema,
  setTeamArgsSchema,
} from '../validation';

const BOT_DELAY_MS = Number(process.env.BOT_DELAY_MS ?? 1200);

interface SocketData {
  roomCode?: string;
  playerId?: string;
  /** id авторизованного пользователя (из JWT handshake); undefined у гостей. */
  userId?: string;
}

type CodenamesNamespace = Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

function hasGuesser(room: Room, team: Team): boolean {
  return [...room.players.values()].some((p) => p.team === team && p.role === 'guesser');
}

function hasHumanCaptain(room: Room, team: Team): boolean {
  return [...room.players.values()].some((p) => p.team === team && p.role === 'captain');
}

export function registerCodenames(nsp: CodenamesNamespace): Janitable {
  const manager = new RoomManager();

  /** Рассылает состояние комнаты, персональные виды игры и дедлайн хода всем её сокетам. */
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

  /** Пишет результат партии в БД для всех авторизованных игроков комнаты. */
  async function recordFinish(room: Room): Promise<void> {
    const game = room.game;
    if (!process.env.DATABASE_URL || !game || game.winner == null) return;
    const winner = game.winner;
    // Дедуп по userId: 2 вкладки одного юзера → 1 запись GameResult (а не 2).
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
            game: 'codenames',
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

  /** Шлёт текущий дедлайн хода всем сокетам комнаты (отдельно от полного broadcast). */
  function emitTimer(room: Room): void {
    for (const [, socket] of nsp.sockets) {
      const data = socket.data;
      if (data.roomCode !== room.code || !data.playerId) continue;
      socket.emit('game:timer', room.phase === 'playing' ? room.turnDeadline : null);
    }
  }

  /** Снимает таймер хода без рассылки. */
  function dropTimer(room: Room): void {
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    room.turnDeadline = null;
  }

  /** Снимает таймер хода и рассылает обнулённый дедлайн. */
  function clearTimer(room: Room): void {
    dropTimer(room);
    emitTimer(room);
  }

  /**
   * Ставит таймер на дедлайн (ms) и СРАЗУ рассылает его клиентам.
   * По срабатыванию: фаза clue → тайм-аут капитана, фаза guess → авто-пас.
   */
  function setDeadline(room: Room, deadline: number, onExpire: () => void): void {
    dropTimer(room);
    room.turnDeadline = deadline;
    const game = room.game;
    const delay = Math.max(0, deadline - Date.now());
    room.timer = setTimeout(() => {
      room.timer = null;
      // Состояние сменилось (был ход) или комнаты уже нет — таймер устарел.
      if (!manager.get(room.code) || room.game !== game || room.phase !== 'playing') return;
      onExpire();
    }, delay);
    emitTimer(room);
  }

  /** Тайм-аут отгадывания: ход переходит другой команде. */
  function onGuessTimeout(room: Room): void {
    manager.timeoutPass(room);
    broadcast(room);
    scheduleTurnTimer(room);
    scheduleBot(room);
  }

  /** «Время игроков» истекло, а подсказки так и нет — ход переходит другой команде. */
  function onClueGraceTimeout(room: Room): void {
    manager.timeoutSkipClue(room);
    broadcast(room);
    scheduleTurnTimer(room);
    scheduleBot(room);
  }

  /** Таймер фазы отгадывания (turnSec). */
  function armGuessTimer(room: Room): void {
    const t = room.settings.timer;
    if (!t?.enabled) {
      clearTimer(room);
      return;
    }
    setDeadline(room, Date.now() + t.turnSec * 1000, () => onGuessTimeout(room));
  }

  /**
   * Назначает таймер для текущего хода с нуля (вход в фазу).
   * Фаза clue (живой капитан): firstTurnSec (120) на первом ходу, иначе turnSec (60).
   * Если капитан не успел — ход НЕ пропускаем: запускаем «время игроков» (turnSec),
   * ход остаётся у капитана; только если и оно истекло — ход переходит.
   * Фаза guess: turnSec на отгадывание. Бот-капитану таймер не нужен — ответит сам.
   */
  function scheduleTurnTimer(room: Room): void {
    const t = room.settings.timer;
    const game = room.game;
    if (!t?.enabled || room.phase !== 'playing' || !game || game.phase === 'finished') {
      clearTimer(room);
      return;
    }
    if (game.phase === 'guess') {
      if (!hasGuesser(room, game.turn)) {
        clearTimer(room);
        return;
      }
      armGuessTimer(room);
      return;
    }
    // фаза clue
    if (room.settings.botCaptains[game.turn]) {
      clearTimer(room);
      return;
    }
    if (!hasHumanCaptain(room, game.turn) || !hasGuesser(room, game.turn)) {
      // ждём, пока сядет живой капитан и хотя бы один отгадывающий
      clearTimer(room);
      return;
    }
    const isFirstClue = game.log.length === 0;
    const sec = isFirstClue ? (t.firstTurnSec ?? t.turnSec * 2) : t.turnSec;
    setDeadline(room, Date.now() + sec * 1000, () => {
      // капитан не успел подумать — даём «время игроков», ход всё ещё у капитана
      setDeadline(room, Date.now() + t.turnSec * 1000, () => onClueGraceTimeout(room));
      broadcast(room);
    });
  }

  /** Бонус за верное слово: продлевает текущий дедлайн отгадывания на bonusSec. */
  function addGuessBonus(room: Room): void {
    const t = room.settings.timer;
    if (!t?.enabled || room.turnDeadline == null) return;
    const deadline = room.turnDeadline + (t.bonusSec ?? 0) * 1000;
    setDeadline(room, deadline, () => onGuessTimeout(room));
  }

  /** Если у текущей команды бот-капитан — даёт подсказку с задержкой. */
  function scheduleBot(room: Room): void {
    if (!room.game || room.game.phase !== 'clue') return;
    if (!room.settings.botCaptains[room.game.turn] || room.botPending) return;
    if (!hasGuesser(room, room.game.turn)) return;
    room.botPending = true;
    const expectedTurn = room.game.turn;
    setTimeout(() => {
      room.botPending = false;
      if (!manager.get(room.code) || room.game?.turn !== expectedTurn) return;
      if (manager.botClue(room)) {
        broadcast(room);
        scheduleTurnTimer(room);
      }
    }, BOT_DELAY_MS);
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

    socket.on('room:create', (nickname, settings, ack) => {
      void (async () => {
        try {
          const cleanSettings = parseSocketArg(socket, codenamesSettingsSchema, settings);
          if (cleanSettings === null) return ack({ ok: false, error: 'Некорректные настройки' });
          const id = await resolveIdentity(data.userId);
          const { room, player } = manager.createRoom(
            id.nickname ?? nickname,
            cleanSettings,
            id.avatarUrl,
          );
          manager.dealNow(room);
          data.roomCode = room.code;
          data.playerId = player.id;
          await socket.join(room.code);
          ack({ ok: true, room: manager.roomView(room), playerId: player.id, token: player.token });
          socket.emit('chat:history', room.chat);
          broadcast(room);
          scheduleBot(room);
          scheduleTurnTimer(room);
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
          data.roomCode = room.code;
          data.playerId = player.id;
          await socket.join(room.code);
          ack({ ok: true, room: manager.roomView(room), playerId: player.id, token: player.token });
          socket.emit('chat:history', room.chat);
          broadcast(room);
        } catch (e) {
          ack({ ok: false, error: e instanceof RoomError ? e.message : 'Внутренняя ошибка' });
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
      if (removed) clearTimer(room);
      else broadcast(room);
    };

    socket.on('room:leave', leaveCurrent);
    socket.on('disconnect', leaveCurrent);

    socket.on('room:setTeam', (team, role) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const args = parseSocketArg(socket, setTeamArgsSchema, [team, role]);
        if (args === null) return;
        manager.setTeam(room, data.playerId, args[0], args[1]);
        broadcast(room);
        scheduleBot(room);
        scheduleTurnTimer(room);
      }),
    );

    socket.on('room:setCaptain', (team, who) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const args = parseSocketArg(socket, setCaptainArgsSchema, [team, who]);
        if (args === null) return;
        manager.setCaptainSlot(room, data.playerId, args[0], args[1]);
        broadcast(room);
        scheduleBot(room);
        scheduleTurnTimer(room);
      }),
    );

    socket.on('room:settings', (settings) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const clean = parseSocketArg(socket, codenamesSettingsSchema, settings);
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
        scheduleBot(room);
        scheduleTurnTimer(room);
      }),
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

    socket.on('game:clue', (clue) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const clean = parseSocketArg(socket, clueSchema, clue);
        if (clean === null) return;
        manager.giveClue(room, data.playerId, clean);
        broadcast(room);
        scheduleTurnTimer(room);
      }),
    );

    socket.on('game:guess', (cardIndex) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const clean = parseSocketArg(socket, cardIndexSchema, cardIndex);
        if (clean === null) return;
        const before = room.game;
        manager.guess(room, data.playerId, clean);
        broadcast(room);
        const after = room.game;
        // верное слово, ход остался у той же команды → бонус к таймеру; иначе новый ход
        if (after && before && after.phase === 'guess' && after.turn === before.turn) {
          addGuessBonus(room);
        } else {
          scheduleTurnTimer(room);
        }
        scheduleBot(room);
        if (after?.phase === 'finished') void recordFinish(room);
      }),
    );

    socket.on('game:pass', () =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        manager.pass(room, data.playerId);
        broadcast(room);
        scheduleTurnTimer(room);
        scheduleBot(room);
      }),
    );

    socket.on('room:newRound', () =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        manager.newRound(room, data.playerId);
        broadcast(room);
        scheduleBot(room);
        scheduleTurnTimer(room);
      }),
    );
  });
  return {
    cleanupStale: manager.cleanupStale.bind(manager),
    restore: (snapshots) => snapshots.filter((s) => manager.restoreFromSnapshot(s.state)).length,
  };
}
