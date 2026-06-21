/** Комнаты в памяти: создание/вход по коду, команды, запуск Коднеймс, ходы. */
import { randomUUID } from 'node:crypto';
import { snapshotRoom as persistSnapshot, deleteRoom as persistDelete } from '../persist';
import {
  BOARD_SIZE,
  createGame,
  generateRoomCode,
  giveClue,
  guess,
  pass,
  pickWords,
  redactCodenames,
  skipClue,
} from '@boardgames/shared';
// bot (+ embeddings 1.2 МБ) — отдельный entry, не через barrel, чтобы не тащить
// embeddings в web-бандл. См. packages/shared/package.json exports.
import { suggestClue } from '@boardgames/shared/codenames/bot';
import type {
  ChatMessage,
  Clue,
  CodenamesState,
  CodenamesView,
  PlayerRole,
  RoomPhase,
  RoomPlayer,
  RoomSettings,
  RoomView,
  Team,
} from '@boardgames/shared';

export class RoomError extends Error {}

interface PlayerRecord extends RoomPlayer {
  token: string;
}

export interface Room {
  code: string;
  hostId: string;
  phase: RoomPhase;
  settings: RoomSettings;
  players: Map<string, PlayerRecord>;
  chat: ChatMessage[];
  game: CodenamesState | null;
  /** Подсказка бота уже запрошена (анти-дубль). */
  botPending: boolean;
  /** Счёт серии в этой комнате (red/blue выигрыши). */
  series: Record<Team, number>;
  /** Когда началась текущая партия (ms) или null в лобби. */
  startedAt: number | null;
  /** Дедлайн текущего хода (ms, Date.now()) или null, если таймер выключен/не идёт. */
  turnDeadline: number | null;
  /** Активный таймер автоперехода хода (clearTimeout при любой смене состояния). */
  timer: ReturnType<typeof setTimeout> | null;
}

export const MAX_PLAYERS = 8;
const MAX_CHAT = 100;
const MAX_NICK = 24;

export const DEFAULT_SETTINGS: RoomSettings = {
  game: 'codenames',
  botCaptains: { red: true, blue: true },
  botRisk: 'normal',
  timer: { enabled: true, turnSec: 60, firstTurnSec: 120, bonusSec: 10 },
};

export class RoomManager {
  private rooms = new Map<string, Room>();

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  createRoom(
    nickname: string,
    settings: RoomSettings,
    avatarUrl: string | null = null,
  ): { room: Room; player: PlayerRecord } {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();
    const player = makePlayer(nickname, avatarUrl);
    const room: Room = {
      code,
      hostId: player.id,
      phase: 'lobby',
      settings: { ...DEFAULT_SETTINGS, ...settings, game: 'codenames' },
      players: new Map([[player.id, player]]),
      chat: [],
      game: null,
      botPending: false,
      series: { red: 0, blue: 0 },
      startedAt: null,
      turnDeadline: null,
      timer: null,
    };
    this.rooms.set(code, room);
    this.snapshotRoom(room);
    return { room, player };
  }

  joinRoom(
    code: string,
    nickname: string,
    avatarUrl: string | null = null,
  ): { room: Room; player: PlayerRecord } {
    const room = this.get(code);
    if (!room) throw new RoomError('Комната не найдена');
    if (room.phase === 'finished') throw new RoomError('Партия завершена, дождитесь нового раунда');
    if (room.players.size >= MAX_PLAYERS) throw new RoomError('Комната заполнена');
    const player = makePlayer(nickname, avatarUrl);
    room.players.set(player.id, player);
    this.snapshotRoom(room);
    return { room, player };
  }

  rejoin(code: string, token: string): { room: Room; player: PlayerRecord } {
    const room = this.get(code);
    if (!room) throw new RoomError('Комната не найдена');
    const player = [...room.players.values()].find((p) => p.token === token);
    if (!player) throw new RoomError('Игрок не найден');
    player.connected = true;
    this.snapshotRoom(room);
    return { room, player };
  }

  /** Возвращает true, если комната удалена (опустела). */
  leave(room: Room, playerId: string): boolean {
    const player = room.players.get(playerId);
    if (!player) return false;
    if (room.phase === 'lobby') room.players.delete(playerId);
    else player.connected = false;
    const anyConnected = [...room.players.values()].some((p) => p.connected);
    if (room.players.size === 0 || (room.phase !== 'lobby' && !anyConnected)) {
      void persistDelete('codenames', room.code);
      this.rooms.delete(room.code);
      return true;
    }
    if (room.hostId === playerId && room.players.size > 0) {
      const next = [...room.players.values()][0];
      if (next) room.hostId = next.id;
    }
    this.snapshotRoom(room);
    return false;
  }

  /**
   * Чистка зомби-комнат (janitor): удаляет комнаты без живых сокетов. lobby/finished
   * — сразу; playing — по grace от turnDeadline (игрок успеет реконнектнуться).
   * Возвращает коды удалённых. См. `janitor.ts`.
   */
  cleanupStale(hasLiveSocket: (code: string) => boolean, now: number, graceMs: number): string[] {
    const deleted: string[] = [];
    for (const [code, room] of this.rooms) {
      if (hasLiveSocket(code)) continue;
      if (
        room.phase === 'lobby' ||
        room.phase === 'finished' ||
        (room.turnDeadline != null && room.turnDeadline + graceMs < now)
      ) {
        if (room.timer) {
          clearTimeout(room.timer);
          room.timer = null;
        }
        this.rooms.delete(code);
        void persistDelete('codenames', code);
        deleted.push(code);
      }
    }
    return deleted;
  }

  setTeam(room: Room, playerId: string, team: Team, role: PlayerRole): void {
    if (room.phase === 'finished') throw new RoomError('Состав можно менять до конца партии');
    const player = room.players.get(playerId);
    if (!player) throw new RoomError('Игрок не найден');
    if (role === 'captain') {
      if (room.settings.botCaptains[team]) throw new RoomError('У этой команды капитан — бот');
      const taken = [...room.players.values()].some(
        (p) => p.id !== playerId && p.team === team && p.role === 'captain',
      );
      if (taken) throw new RoomError('Капитан этой команды уже выбран');
    }
    player.team = team;
    player.role = role;
    this.snapshotRoom(room);
  }

  updateSettings(room: Room, playerId: string, settings: RoomSettings): void {
    if (playerId !== room.hostId) throw new RoomError('Настройки меняет только хост');
    if (room.phase !== 'lobby') throw new RoomError('Игра уже началась');
    room.settings = { ...room.settings, ...settings, game: 'codenames' };
    // если команде включили бот-капитана — снимаем человеческого
    for (const p of room.players.values()) {
      if (p.team && p.role === 'captain' && room.settings.botCaptains[p.team]) p.role = 'guesser';
    }
    this.snapshotRoom(room);
  }

  start(room: Room, playerId: string): void {
    if (playerId !== room.hostId) throw new RoomError('Начать игру может только хост');
    if (room.phase !== 'lobby') throw new RoomError('Игра уже началась');
    for (const team of ['red', 'blue'] as Team[]) {
      const members = [...room.players.values()].filter((p) => p.team === team);
      if (members.filter((p) => p.role === 'guesser').length === 0)
        throw new RoomError(`У команды ${team === 'red' ? 'красных' : 'синих'} нет отгадывающих`);
      if (!room.settings.botCaptains[team] && !members.some((p) => p.role === 'captain'))
        throw new RoomError(
          `У команды ${team === 'red' ? 'красных' : 'синих'} нет капитана (или включите бота)`,
        );
    }
    room.game = createGame(pickWords(BOARD_SIZE));
    room.phase = 'playing';
    room.startedAt = Date.now();
    this.snapshotRoom(room);
  }

  giveClue(room: Room, playerId: string, clue: Clue): void {
    const { game, player } = this.requireGame(room, playerId);
    if (player.team !== game.turn || player.role !== 'captain')
      throw new RoomError('Сейчас подсказку даёт капитан другой команды');
    room.game = giveClue(game, clue);
    this.snapshotRoom(room);
  }

  /** Подсказка бота-капитана для текущей команды (вызывается сервером). */
  botClue(room: Room): boolean {
    const game = room.game;
    if (!game || game.phase !== 'clue' || !room.settings.botCaptains[game.turn]) return false;
    const trace = suggestClue(game, game.turn, room.settings.botRisk);
    if (!trace) return false; // у команды нет закрытых слов — не бывает в фазе clue
    room.game = giveClue(game, trace.clue);
    this.snapshotRoom(room);
    return true;
  }

  guess(room: Room, playerId: string, cardIndex: number): void {
    const { game, player } = this.requireGame(room, playerId);
    if (player.team !== game.turn || player.role !== 'guesser')
      throw new RoomError('Сейчас отгадывает другая команда');
    room.game = guess(game, cardIndex);
    if (room.game.phase === 'finished') {
      room.phase = 'finished';
      const winner = room.game.winner;
      if (winner) room.series[winner] += 1;
    }
    this.snapshotRoom(room);
  }

  pass(room: Room, playerId: string): void {
    const { game, player } = this.requireGame(room, playerId);
    if (player.team !== game.turn || player.role !== 'guesser')
      throw new RoomError('Сейчас ходит другая команда');
    room.game = pass(game);
    this.snapshotRoom(room);
  }

  /** Тайм-аут фазы отгадывания: ход переходит (сервер, без игрока). */
  timeoutPass(room: Room): void {
    if (!room.game || room.phase !== 'playing' || room.game.phase !== 'guess') return;
    room.game = pass(room.game);
    this.snapshotRoom(room);
  }

  /** Тайм-аут капитана: подсказка не дана, ход переходит другой команде. */
  timeoutSkipClue(room: Room): void {
    if (!room.game || room.phase !== 'playing' || room.game.phase !== 'clue') return;
    room.game = skipClue(room.game);
    this.snapshotRoom(room);
  }

  /** Слот капитана команды: сесть самому ('me'), поставить бота ('bot') или освободить ('open'). */
  setCaptainSlot(room: Room, playerId: string, team: Team, who: 'me' | 'bot' | 'open'): void {
    if (room.phase === 'finished') throw new RoomError('Состав можно менять до конца партии');
    const player = room.players.get(playerId);
    if (!player) throw new RoomError('Игрок не найден');
    const demoteHumanCaptain = (): void => {
      for (const p of room.players.values()) {
        if (p.team === team && p.role === 'captain') p.role = 'guesser';
      }
    };
    if (who === 'bot') {
      demoteHumanCaptain();
      room.settings.botCaptains[team] = true;
    } else if (who === 'open') {
      demoteHumanCaptain();
      room.settings.botCaptains[team] = false;
    } else {
      const taken = [...room.players.values()].some(
        (p) => p.id !== playerId && p.team === team && p.role === 'captain',
      );
      if (taken) throw new RoomError('Капитан этой команды уже выбран');
      room.settings.botCaptains[team] = false;
      player.team = team;
      player.role = 'captain';
    }
    this.snapshotRoom(room);
  }

  /** Раздаёт поле и сразу переводит комнату в игру (без проверок состава). */
  dealNow(room: Room): void {
    room.game = createGame(pickWords(BOARD_SIZE));
    room.phase = 'playing';
    room.startedAt = Date.now();
    room.botPending = false;
    room.turnDeadline = null;
    this.snapshotRoom(room);
  }

  /** Новый раунд: пересдаём поле; состав команд и счёт серии остаются. */
  newRound(room: Room, playerId: string): void {
    if (playerId !== room.hostId) throw new RoomError('Новый раунд начинает хост');
    if (room.phase !== 'finished') throw new RoomError('Игра ещё не закончена');
    this.dealNow(room);
  }

  viewFor(room: Room, playerId: string): CodenamesView | null {
    if (!room.game) return null;
    const player = room.players.get(playerId);
    const seesKey =
      (player?.role === 'captain' && player.team !== null) || room.game.phase === 'finished';
    return redactCodenames(room.game, seesKey);
  }

  roomView(room: Room): RoomView {
    return {
      code: room.code,
      hostId: room.hostId,
      phase: room.phase,
      settings: room.settings,
      series: room.series,
      startedAt: room.startedAt,
      players: [...room.players.values()].map(({ token: _token, ...p }) => p),
    };
  }

  /**
   * Снапшот комнаты в Redis (persist §1). Готовит plain-объект (Map → массив
   * entries, без timer-функции) и вызывает persist.snapshotRoom. Best-effort:
   * ошибки persist не бросают (логируются внутри persist.ts).
   */
  snapshotRoom(room: Room): void {
    const snapshot = {
      code: room.code,
      hostId: room.hostId,
      phase: room.phase,
      settings: room.settings,
      players: [...room.players.entries()].map(([id, p]) => [id, { ...p }]),
      chat: room.chat.slice(-50),
      game: room.game,
      botPending: room.botPending,
      series: room.series,
      startedAt: room.startedAt,
      turnDeadline: room.turnDeadline,
    };
    void persistSnapshot('codenames', room.code, snapshot);
  }

  /**
   * Восстанавливает комнату из Redis-снапшота (аудит §1 restore-on-startup).
   * Принимает plain-объект из persist.loadAllRooms, реконструирует Room
   * (array → Map для players, timer = null — таймеры в handlers), кладёт в Map.
   * Все players.connected = false (после рестарта никто не подключён).
   * Возвращает true при успехе.
   */
  restoreFromSnapshot(s: unknown): boolean {
    try {
      const snap = s as Record<string, unknown>;
      const playersEntries = snap.players as [string, PlayerRecord][] | undefined;
      if (!playersEntries || !snap.code || !snap.phase) return false;
      const players = new Map<string, PlayerRecord>();
      for (const [id, p] of playersEntries) {
        players.set(id, { ...p, connected: false });
      }
      const room: Room = {
        code: snap.code as string,
        hostId: snap.hostId as string,
        phase: snap.phase as RoomPhase,
        settings: snap.settings as RoomSettings,
        players,
        chat: (snap.chat as ChatMessage[]) ?? [],
        game: (snap.game as CodenamesState | null) ?? null,
        botPending: (snap.botPending as boolean) ?? false,
        series: (snap.series as Record<Team, number>) ?? { red: 0, blue: 0 },
        startedAt: (snap.startedAt as number | null) ?? null,
        turnDeadline: (snap.turnDeadline as number | null) ?? null,
        timer: null, // таймер перевооружится в handlers при следующем действии
      };
      this.rooms.set(room.code, room);
      return true;
    } catch {
      return false;
    }
  }

  addChat(room: Room, playerId: string, text: string): ChatMessage {
    const player = room.players.get(playerId);
    if (!player) throw new RoomError('Игрок не найден');
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed) throw new RoomError('Пустое сообщение');
    const msg: ChatMessage = {
      authorId: player.id,
      authorName: player.nickname,
      text: trimmed,
      sentAt: Date.now(),
    };
    room.chat.push(msg);
    if (room.chat.length > MAX_CHAT) room.chat.shift();
    return msg;
  }

  private requireGame(
    room: Room,
    playerId: string,
  ): { game: CodenamesState; player: PlayerRecord } {
    const game = room.game;
    const player = room.players.get(playerId);
    if (!game || room.phase !== 'playing') throw new RoomError('Игра не идёт');
    if (!player) throw new RoomError('Игрок не найден');
    return { game, player };
  }
}

function makePlayer(nickname: string, avatarUrl: string | null = null): PlayerRecord {
  const nick = nickname.trim().slice(0, MAX_NICK);
  if (!nick) throw new RoomError('Введите ник');
  return {
    id: randomUUID(),
    token: randomUUID(),
    nickname: nick,
    avatarUrl,
    team: null,
    role: 'guesser',
    connected: true,
  };
}
