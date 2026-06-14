/** Socket-хендлеры Коднеймс на namespace /codenames. Авторитарный сервер: клиент шлёт намерения. */
import type { Namespace } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@boardgames/shared';
import { RoomError, RoomManager } from './manager';
import type { Room } from './manager';

const BOT_DELAY_MS = Number(process.env.BOT_DELAY_MS ?? 1200);

interface SocketData {
  roomCode?: string;
  playerId?: string;
}

type CodenamesNamespace = Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export function registerCodenames(nsp: CodenamesNamespace): void {
  const manager = new RoomManager();

  /** Рассылает состояние комнаты, персональные виды игры и дедлайн хода всем её сокетам. */
  function broadcast(room: Room): void {
    for (const [, socket] of nsp.sockets) {
      const data = socket.data;
      if (data.roomCode !== room.code || !data.playerId) continue;
      socket.emit('room:state', manager.roomView(room));
      const gameView = manager.viewFor(room, data.playerId);
      if (gameView) socket.emit('game:state', gameView);
      socket.emit('game:timer', room.phase === 'playing' ? room.turnDeadline : null);
    }
  }

  /** Снимает активный таймер хода и обнуляет дедлайн. */
  function clearTimer(room: Room): void {
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    room.turnDeadline = null;
  }

  /**
   * Ставит таймер на конкретный дедлайн (ms). По срабатыванию:
   * фаза clue → тайм-аут капитана (пропуск хода), фаза guess → авто-пас.
   */
  function armTimer(room: Room, deadline: number): void {
    clearTimer(room);
    room.turnDeadline = deadline;
    const game = room.game;
    const delay = Math.max(0, deadline - Date.now());
    room.timer = setTimeout(() => {
      room.timer = null;
      // Состояние сменилось (был ход) или комнаты уже нет — таймер устарел.
      if (!manager.get(room.code) || room.game !== game || room.phase !== 'playing') return;
      if (!game) return;
      if (game.phase === 'clue') manager.timeoutSkipClue(room);
      else if (game.phase === 'guess') manager.timeoutPass(room);
      else return;
      broadcast(room);
      scheduleTurnTimer(room);
      scheduleBot(room);
    }, delay);
  }

  /**
   * Назначает таймер для текущего хода с нуля (вход в фазу).
   * Первый ход партии — firstTurnSec (120), остальные — turnSec (60).
   * Для бот-капитана на фазе clue таймер не нужен — бот ответит сам.
   */
  function scheduleTurnTimer(room: Room): void {
    clearTimer(room);
    const t = room.settings.timer;
    const game = room.game;
    if (!t?.enabled || room.phase !== 'playing' || !game || game.phase === 'finished') return;
    if (game.phase === 'clue' && room.settings.botCaptains[game.turn]) return;
    const isFirstClue = game.phase === 'clue' && game.log.length === 0;
    const sec = isFirstClue ? (t.firstTurnSec ?? t.turnSec * 2) : t.turnSec;
    armTimer(room, Date.now() + sec * 1000);
  }

  /** Бонус за верное слово: продлевает текущий дедлайн отгадывания на bonusSec. */
  function addGuessBonus(room: Room): void {
    const t = room.settings.timer;
    if (!t?.enabled || room.turnDeadline == null) return;
    armTimer(room, room.turnDeadline + (t.bonusSec ?? 0) * 1000);
  }

  /** Если у текущей команды бот-капитан — даёт подсказку с задержкой. */
  function scheduleBot(room: Room): void {
    if (!room.game || room.game.phase !== 'clue') return;
    if (!room.settings.botCaptains[room.game.turn] || room.botPending) return;
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
      if (removed) clearTimer(room);
      else broadcast(room);
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
        scheduleTurnTimer(room);
      }),
    );

    socket.on('chat:send', (text) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const msg = manager.addChat(room, data.playerId, text);
        nsp.to(room.code).emit('chat:message', msg);
      }),
    );

    socket.on('game:clue', (clue) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        manager.giveClue(room, data.playerId, clue);
        broadcast(room);
        scheduleTurnTimer(room);
      }),
    );

    socket.on('game:guess', (cardIndex) =>
      guard(() => {
        const room = inRoom();
        if (!room || !data.playerId) return;
        const before = room.game;
        manager.guess(room, data.playerId, cardIndex);
        broadcast(room);
        const after = room.game;
        // верное слово, ход остался у той же команды → бонус к таймеру; иначе новый ход
        if (after && before && after.phase === 'guess' && after.turn === before.turn) {
          addGuessBonus(room);
        } else {
          scheduleTurnTimer(room);
        }
        scheduleBot(room);
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
        clearTimer(room);
        broadcast(room);
      }),
    );
  });
}
