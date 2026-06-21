/**
 * Комнаты Alias в памяти: создание/вход по коду, 2 команды, ведущий по кругу,
 * словарь из БД (по сложности), серверный таймер раунда.
 *
 * Переиспользуем Team/PlayerRole из Коднеймс: captain = текущий объясняющий
 * (меняется по кругу каждый раунд), guesser = отгадывающий.
 */
import { randomUUID } from 'node:crypto';
import { snapshotRoom as persistSnapshot, deleteRoom as persistDelete } from '../persist';
import {
  createAliasGame,
  endRound,
  finishGame,
  generateRoomCode,
  markGuessed,
  markSkipped,
  otherTeam,
  redactAlias,
  startRound,
} from '@boardgames/shared';
import type {
  AliasRoomSettings,
  AliasRoomView,
  AliasSettingsPatch,
  AliasState,
  AliasView,
  ChatMessage,
  PlayerRole,
  RoomPhase,
  Team,
} from '@boardgames/shared';

export class RoomError extends Error {}

interface PlayerRecord {
  id: string;
  token: string;
  nickname: string;
  avatarUrl: string | null;
  team: Team | null;
  role: PlayerRole;
  connected: boolean;
}

export interface Room {
  code: string;
  hostId: string;
  phase: RoomPhase;
  settings: AliasRoomSettings;
  players: Map<string, PlayerRecord>;
  chat: ChatMessage[];
  game: AliasState | null;
  /** Пул слов текущей сложности (мешается один раз при старте партии). */
  wordPool: string[];
  /** Индекс следующего слова в wordPool. */
  wordCursor: number;
  /** Индекс следующего объясняющего в составе каждой команды (по кругу). */
  explainerIndex: Record<Team, number>;
  /** Сколько раундов сыграно — для определения конца круга. */
  roundsPlayed: number;
  /** Когда началась текущая партия (ms) или null в лобби. */
  startedAt: number | null;
  /** Дедлайн текущего раунда (ms) или null. */
  turnDeadline: number | null;
  /** Активный таймер раунда. */
  timer: ReturnType<typeof setTimeout> | null;
}

export const MAX_PLAYERS = 8;
const MAX_CHAT = 100;
const MAX_NICK = 24;
const MIN_TEAM_SIZE = 2;

export const DEFAULT_SETTINGS: AliasRoomSettings = {
  game: 'alias',
  difficulty: 'medium',
  roundDuration: 60,
  targetScore: 30,
  showOpponents: true,
};

const VALID_DURATIONS = new Set([30, 60, 90]);

export class RoomManager {
  private rooms = new Map<string, Room>();

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  createRoom(
    nickname: string,
    patch: AliasSettingsPatch,
    avatarUrl: string | null = null,
  ): { room: Room; player: PlayerRecord } {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();
    const player = makePlayer(nickname, avatarUrl);
    const room: Room = {
      code,
      hostId: player.id,
      phase: 'lobby',
      settings: { ...DEFAULT_SETTINGS, ...patchSettings(patch) },
      players: new Map([[player.id, player]]),
      chat: [],
      game: null,
      wordPool: [],
      wordCursor: 0,
      explainerIndex: { red: 0, blue: 0 },
      roundsPlayed: 0,
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

  leave(room: Room, playerId: string): boolean {
    const player = room.players.get(playerId);
    if (!player) return false;
    if (room.phase === 'lobby') room.players.delete(playerId);
    else player.connected = false;
    const anyConnected = [...room.players.values()].some((p) => p.connected);
    if (room.players.size === 0 || (room.phase !== 'lobby' && !anyConnected)) {
      void persistDelete('alias', room.code);
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
        void persistDelete('alias', code);
        deleted.push(code);
      }
    }
    return deleted;
  }

  setTeam(room: Room, playerId: string, team: Team, _role: PlayerRole): void {
    if (room.phase === 'finished') throw new RoomError('Состав можно менять до конца партии');
    const player = room.players.get(playerId);
    if (!player) throw new RoomError('Игрок не найден');
    player.team = team;
    // В Alias captain = текущий объясняющий (назначается по кругу), поэтому
    // вручную сесть капитаном нельзя — всегда guesser; объясняющий определяется сервером.
    player.role = 'guesser';
    this.snapshotRoom(room);
  }

  updateSettings(room: Room, playerId: string, patch: AliasSettingsPatch): void {
    if (playerId !== room.hostId) throw new RoomError('Настройки меняет только хост');
    if (room.phase !== 'lobby') throw new RoomError('Игра уже началась');
    room.settings = { ...room.settings, ...patchSettings(patch) };
    this.snapshotRoom(room);
  }

  /** Запуск партии: проверяем состав, грузим словарь, стартуем первый раунд. */
  async start(room: Room, playerId: string): Promise<void> {
    if (playerId !== room.hostId) throw new RoomError('Начать игру может только хост');
    if (room.phase !== 'lobby') throw new RoomError('Игра уже началась');
    for (const team of ['red', 'blue'] as Team[]) {
      const members = this.teamMembers(room, team);
      if (members.length < MIN_TEAM_SIZE) {
        throw new RoomError(
          `У команды ${team === 'red' ? 'красных' : 'синих'} меньше ${MIN_TEAM_SIZE} игроков`,
        );
      }
    }
    const pool = await loadWordPool(room.settings.difficulty);
    if (pool.length < 10) {
      throw new RoomError('Словарь слишком мал для этой сложности. Заполните БД.');
    }
    shuffleInPlace(pool);
    room.wordPool = pool;
    room.wordCursor = 0;
    room.roundsPlayed = 0;
    room.explainerIndex = { red: 0, blue: 0 };

    const startingTeam: Team = Math.random() < 0.5 ? 'red' : 'blue';
    room.game = createAliasGame({
      targetScore: room.settings.targetScore,
      difficulty: room.settings.difficulty,
      roundDuration: room.settings.roundDuration,
      startingTeam,
    });
    room.phase = 'playing';
    room.startedAt = Date.now();
    this.beginRound(room, startingTeam);
    this.snapshotRoom(room);
  }

  /** Ведущий подтвердил угаданное слово. */
  markGuessed(room: Room, playerId: string): void {
    const { game, player } = this.requireRound(room, playerId);
    if (game.explainer !== player.id) throw new RoomError('Подтверждает только ведущий');
    const next = this.nextWord(room);
    room.game = markGuessed(game, next);
    this.afterWord(room);
  }

  /** Ведущий пропустил слово. */
  markSkipped(room: Room, playerId: string): void {
    const { game, player } = this.requireRound(room, playerId);
    if (game.explainer !== player.id) throw new RoomError('Подтверждает только ведущий');
    const next = this.nextWord(room);
    room.game = markSkipped(game, next);
    this.afterWord(room);
  }

  /** Таймер раунда истёк (сервер): текущее слово сгорает, раунд завершён. */
  timeoutEnd(room: Room): void {
    if (!room.game || room.phase !== 'playing' || room.game.phase !== 'round') return;
    room.game = endRound(room.game);
    this.afterRound(room);
  }

  /** Новый раунд после финала: пересоздаём партию с новым пулом. */
  async newRound(room: Room, playerId: string): Promise<void> {
    if (playerId !== room.hostId) throw new RoomError('Новый раунд начинает хост');
    if (room.phase !== 'finished') throw new RoomError('Игра ещё не закончена');
    const pool = await loadWordPool(room.settings.difficulty);
    if (pool.length < 10) throw new RoomError('Словарь слишком мал');
    shuffleInPlace(pool);
    room.wordPool = pool;
    room.wordCursor = 0;
    room.roundsPlayed = 0;
    room.explainerIndex = { red: 0, blue: 0 };
    const startingTeam: Team = Math.random() < 0.5 ? 'red' : 'blue';
    room.game = createAliasGame({
      targetScore: room.settings.targetScore,
      difficulty: room.settings.difficulty,
      roundDuration: room.settings.roundDuration,
      startingTeam,
    });
    room.phase = 'playing';
    room.startedAt = Date.now();
    this.beginRound(room, startingTeam);
    this.snapshotRoom(room);
  }

  viewFor(room: Room, playerId: string): AliasView | null {
    if (!room.game) return null;
    const player = room.players.get(playerId);
    return redactAlias(room.game, {
      id: playerId,
      team: player?.team ?? null,
      isExplainer: room.game.explainer === playerId,
      showOpponents: room.settings.showOpponents,
    });
  }

  roomView(room: Room): AliasRoomView {
    return {
      code: room.code,
      hostId: room.hostId,
      phase: room.phase,
      settings: room.settings,
      players: [...room.players.values()].map(({ token: _token, ...p }) => p),
      startedAt: room.startedAt,
    };
  }

  /**
   * Снапшот комнаты в Redis (persist §1). Map (players) → массив entries,
   * без timer-функции. Best-effort: ошибки не бросают.
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
      wordPool: room.wordPool,
      wordCursor: room.wordCursor,
      explainerIndex: room.explainerIndex,
      roundsPlayed: room.roundsPlayed,
      startedAt: room.startedAt,
      turnDeadline: room.turnDeadline,
    };
    void persistSnapshot('alias', room.code, snapshot);
  }

  /**
   * Восстанавливает комнату из Redis-снапшота (аудит §1 restore-on-startup).
   * Реконструирует Room (array → Map для players), перевооружает таймер раунда
   * если игра в фазе 'round'. Все players.connected = false.
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
        settings: snap.settings as AliasRoomSettings,
        players,
        chat: (snap.chat as ChatMessage[]) ?? [],
        game: (snap.game as AliasState | null) ?? null,
        wordPool: (snap.wordPool as string[]) ?? [],
        wordCursor: (snap.wordCursor as number) ?? 0,
        explainerIndex: (snap.explainerIndex as Record<Team, number>) ?? { red: 0, blue: 0 },
        roundsPlayed: (snap.roundsPlayed as number) ?? 0,
        startedAt: (snap.startedAt as number | null) ?? null,
        turnDeadline: (snap.turnDeadline as number | null) ?? null,
        timer: null,
      };
      this.rooms.set(room.code, room);
      // Перевооружаем таймер раунда если игра активна
      if (room.game && room.phase === 'playing' && room.game.phase === 'round') {
        this.armRoundTimer(room);
      }
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

  // ---------- внутренние ----------

  private teamMembers(room: Room, team: Team): PlayerRecord[] {
    return [...room.players.values()].filter((p) => p.team === team);
  }

  /** Следующее неиспользованное слово из пула или null (пул исчерпан). */
  private nextWord(room: Room): string | null {
    const used = room.game ? new Set(room.game.usedWords) : new Set<string>();
    while (room.wordCursor < room.wordPool.length) {
      const w = room.wordPool[room.wordCursor] as string;
      room.wordCursor += 1;
      if (!used.has(w)) return w;
    }
    return null;
  }

  /** Выбирает следующего объясняющего команды по кругу и стартует раунд. */
  private beginRound(room: Room, team: Team): void {
    const game = room.game;
    if (!game) return;
    const members = this.teamMembers(room, team);
    if (members.length < MIN_TEAM_SIZE) {
      // Не из чего объяснять — раунд скипается, ход переходит (крайний случай).
      room.roundsPlayed += 1;
      this.afterRound(room);
      return;
    }
    const idx = room.explainerIndex[team] % members.length;
    room.explainerIndex[team] = idx + 1;
    const explainer = members[idx] as PlayerRecord;
    // обновляем роли: explainer -> captain, остальные -> guesser
    for (const p of room.players.values()) {
      if (p.team === team) p.role = p.id === explainer.id ? 'captain' : 'guesser';
    }
    const word = this.nextWord(room);
    if (word == null) {
      // пула не хватило даже на старт — завершаем раунд сразу
      room.game = endRound({
        ...game,
        currentTeam: team,
        phase: 'round',
        round: {
          word: null,
          startedAt: Date.now(),
          duration: room.settings.roundDuration,
          guessed: 0,
          skipped: 0,
        },
      });
      this.afterRound(room);
      return;
    }
    room.game = startRound(game, {
      team,
      explainer: explainer.id,
      word,
      duration: room.settings.roundDuration,
    });
    this.armRoundTimer(room);
  }

  /** После обработки слова: если раунд закончился — после-раундовая логика. */
  private afterWord(room: Room): void {
    const game = room.game;
    if (!game) return;
    if (game.phase === 'between') {
      this.dropTimer(room);
      this.afterRound(room);
    } else {
      // раунд продолжается — слово угадано/пропущено, счёт и текущее слово изменились
      this.snapshotRoom(room);
    }
  }

  /**
   * После раунда: проверяем конец круга и победу, затем стартуем раунд другой
   * команды. Если партия окончена — переводим комнату в finished.
   */
  private afterRound(room: Room): void {
    const game = room.game;
    if (!game) return;
    room.roundsPlayed += 1;
    const teams = game.teams;
    const circleDone = room.roundsPlayed % teams.length === 0;
    if (circleDone) {
      const max = Math.max(...teams.map((t) => game.scores[t]));
      const leaders = teams.filter((t) => game.scores[t] === max);
      if (max >= game.targetScore && leaders.length === 1) {
        room.game = finishGame(game, leaders[0] as Team);
        room.phase = 'finished';
        this.snapshotRoom(room);
        return;
      }
      // равенство при достижении цели или никто не достиг — играем дальше
    }
    const nextTeam = otherTeam(game.currentTeam);
    this.beginRound(room, nextTeam);
    this.snapshotRoom(room);
  }

  private armRoundTimer(room: Room): void {
    const game = room.game;
    if (!game || game.phase !== 'round' || !game.round) return;
    this.dropTimer(room);
    const deadline = game.round.startedAt + game.round.duration * 1000;
    room.turnDeadline = deadline;
    const delay = Math.max(0, deadline - Date.now());
    room.timer = setTimeout(() => {
      room.timer = null;
      if (!this.get(room.code) || room.game !== game || room.phase !== 'playing') return;
      this.timeoutEnd(room);
    }, delay);
  }

  private dropTimer(room: Room): void {
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    room.turnDeadline = null;
  }

  private requireRound(room: Room, playerId: string): { game: AliasState; player: PlayerRecord } {
    const game = room.game;
    const player = room.players.get(playerId);
    if (!game || room.phase !== 'playing') throw new RoomError('Игра не идёт');
    if (!player) throw new RoomError('Игрок не найден');
    if (game.phase !== 'round') throw new RoomError('Сейчас нет активного раунда');
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

/** Применяет патч настроек с валидацией. */
function patchSettings(patch: AliasSettingsPatch): Partial<AliasRoomSettings> {
  const out: Partial<AliasRoomSettings> = {};
  if (patch.difficulty === 'easy' || patch.difficulty === 'medium' || patch.difficulty === 'hard') {
    out.difficulty = patch.difficulty;
  }
  if (typeof patch.roundDuration === 'number' && VALID_DURATIONS.has(patch.roundDuration)) {
    out.roundDuration = patch.roundDuration;
  }
  if (typeof patch.targetScore === 'number' && patch.targetScore >= 5 && patch.targetScore <= 200) {
    out.targetScore = patch.targetScore;
  }
  if (typeof patch.showOpponents === 'boolean') {
    out.showOpponents = patch.showOpponents;
  }
  return out;
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
  }
}

/** Ленивая загрузка словаря из БД (db подключается только при DATABASE_URL). */
async function loadWordPool(difficulty: string): Promise<string[]> {
  const { listAliasWords } = await import('@boardgames/db');
  return listAliasWords(difficulty);
}
