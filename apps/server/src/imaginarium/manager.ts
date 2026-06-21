/**
 * Комнаты Imaginarium в памяти: лобби с настройками, индивидуальные игроки
 * (без команд/ролей), 4 фазных таймера (association/choosing/voting/scoring).
 * Движок — из @boardgames/shared; колода — константа IMAGINARIUM_DECK (без БД).
 *
 * Таймерная модель: armTimer перевооружает один таймер под текущую round.phase.
 * Действия игрока (submitLeader/submitCard/castVote/advance/start/newRound)
 * меняют состояние и снапшотят, но НЕ броадкастят — броадкастит хендлер.
 * Срабатывания таймаута (onTimeout) меняют состояние, снапшотят И броадкастят
 * (менеджер сам, т.к. хендлер не участвует).
 */
import { randomUUID } from 'node:crypto';
import { snapshotRoom as persistSnapshot, deleteRoom as persistDelete } from '../persist';
import {
  advanceLeader,
  castVote,
  createImaginariumGame,
  generateRoomCode,
  IMAGINARIUM_DECK,
  redactImaginarium,
  refillHands,
  revealTable,
  skipRound,
  submitCard,
  submitLeader,
  tallyRound,
} from '@boardgames/shared';
import type {
  CardId,
  ChatMessage,
  ImaginariumRoomSettings,
  ImaginariumRoomView,
  ImaginariumSettingsPatch,
  ImaginariumState,
  ImaginariumView,
  RoomPhase,
  ImaginariumRoundPhase,
} from '@boardgames/shared';

export class RoomError extends Error {}

interface PlayerRecord {
  id: string;
  token: string;
  nickname: string;
  avatarUrl: string | null;
  connected: boolean;
}

export interface Room {
  code: string;
  hostId: string;
  phase: RoomPhase;
  settings: ImaginariumRoomSettings;
  players: Map<string, PlayerRecord>;
  chat: ChatMessage[];
  game: ImaginariumState | null;
  startedAt: number | null;
  turnDeadline: number | null;
  /** Активный фазный таймер (clearTimeout при любой смене состояния). */
  timer: ReturnType<typeof setTimeout> | null;
}

export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 3;
const MAX_CHAT = 100;
const MAX_NICK = 24;
/** Авто-продолжение после scoring-паузы (сек), если никто не нажал «Продолжить». */
const SCORING_AUTO_SEC = 30;

export const DEFAULT_SETTINGS: ImaginariumRoomSettings = {
  game: 'imaginarium',
  associationSec: 60,
  choosingSec: 60,
  votingSec: 60,
  targetScore: null,
  handSize: 6,
};

const VALID_HAND_SIZES = new Set([4, 5, 6, 7, 8]);

export class RoomManager {
  private rooms = new Map<string, Room>();

  /** broadcast вызывается после таймаутов (сервер-инициированные смены состояния). */
  constructor(private broadcast: (room: Room) => void = () => {}) {}

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  createRoom(
    nickname: string,
    patch: ImaginariumSettingsPatch,
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

  /** Возвращает true, если комната удалена (не осталось живых людей). */
  leave(room: Room, playerId: string): boolean {
    const player = room.players.get(playerId);
    if (!player) return false;
    if (room.phase === 'lobby') room.players.delete(playerId);
    else player.connected = false;
    const anyConnected = [...room.players.values()].some((p) => p.connected);
    if (room.players.size === 0 || (room.phase !== 'lobby' && !anyConnected)) {
      this.dropTimer(room);
      void persistDelete('imaginarium', room.code);
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
        this.dropTimer(room);
        this.rooms.delete(code);
        void persistDelete('imaginarium', code);
        deleted.push(code);
      }
    }
    return deleted;
  }

  updateSettings(room: Room, playerId: string, patch: ImaginariumSettingsPatch): void {
    if (playerId !== room.hostId) throw new RoomError('Настройки меняет только хост');
    if (room.phase !== 'lobby') throw new RoomError('Игра уже началась');
    room.settings = { ...room.settings, ...patchSettings(patch) };
    this.snapshotRoom(room);
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

  // ─────────────────────────── views ───────────────────────────

  roomView(room: Room): ImaginariumRoomView {
    return {
      code: room.code,
      hostId: room.hostId,
      phase: room.phase,
      settings: room.settings,
      players: [...room.players.values()].map(({ token: _token, ...p }) => p),
      startedAt: room.startedAt,
    };
  }

  viewFor(room: Room, playerId: string): ImaginariumView | null {
    if (!room.game) return null;
    return redactImaginarium(room.game, { id: playerId });
  }

  // ───────────────────────── game flow ─────────────────────────
  // Синхронно: колода — константа, без БД. Хендлер броадкастит после вызова.

  start(room: Room, playerId: string): void {
    if (playerId !== room.hostId) throw new RoomError('Начать игру может только хост');
    if (room.phase !== 'lobby') throw new RoomError('Игра уже началась');
    if (room.players.size < MIN_PLAYERS || room.players.size > MAX_PLAYERS) {
      throw new RoomError(`Нужно игроков от ${MIN_PLAYERS} до ${MAX_PLAYERS}`);
    }
    room.game = createImaginariumGame({
      playerIds: [...room.players.keys()],
      deck: [...IMAGINARIUM_DECK],
      handSize: room.settings.handSize,
      random: Math.random,
    });
    room.phase = 'playing';
    room.startedAt = Date.now();
    this.armTimer(room);
    this.snapshotRoom(room);
  }

  /** Перезапуск партии из finished (тем же составом и настройками). */
  newRound(room: Room, playerId: string): void {
    if (playerId !== room.hostId) throw new RoomError('Новый раунд начинает хост');
    if (room.phase !== 'finished') throw new RoomError('Игра ещё не закончена');
    room.game = createImaginariumGame({
      playerIds: [...room.players.keys()],
      deck: [...IMAGINARIUM_DECK],
      handSize: room.settings.handSize,
      random: Math.random,
    });
    room.phase = 'playing';
    room.startedAt = Date.now();
    this.armTimer(room);
    this.snapshotRoom(room);
  }

  /** Ведущий сдаёт карту + ассоциацию (association → choosing). */
  submitLeader(room: Room, playerId: string, cardId: CardId, association: string): void {
    const game = room.game;
    if (!game || room.phase !== 'playing') throw new RoomError('Игра не идёт');
    if (!game.round || game.round.phase !== 'association') {
      throw new RoomError('Сейчас не фаза ассоциации');
    }
    if (playerId !== game.round.leader) throw new RoomError('Это ход ведущего');
    room.game = submitLeader(game, playerId, cardId, association);
    this.armTimer(room);
    this.snapshotRoom(room);
  }

  /** Не-ведущий сдаёт карту (choosing). При полном наборе — revealTable → voting. */
  submitCard(room: Room, playerId: string, cardId: CardId): void {
    const game = room.game;
    if (!game || room.phase !== 'playing') throw new RoomError('Игра не идёт');
    if (!game.round || game.round.phase !== 'choosing') {
      throw new RoomError('Сейчас не фаза выбора карт');
    }
    if (playerId === game.round.leader) throw new RoomError('Ведущий не сдаёт карту в этой фазе');
    if (game.round.submissions[playerId] != null) {
      throw new RoomError('Вы уже сдали карту');
    }
    const next = submitCard(game, playerId, cardId);
    room.game = next;
    // submissions включает ведущего + всех не-ведущих → players.length когда всё собрано
    if (next.round && Object.keys(next.round.submissions).length === next.players.length) {
      room.game = revealTable(next, Math.random);
      this.armTimer(room);
    }
    this.snapshotRoom(room);
  }

  /** Не-ведущий голосует за слот (voting). При всех голосах — tallyRound → scoring. */
  castVote(room: Room, playerId: string, slot: number): void {
    const game = room.game;
    if (!game || room.phase !== 'playing') throw new RoomError('Игра не идёт');
    if (!game.round || game.round.phase !== 'voting') {
      throw new RoomError('Сейчас не фаза голосования');
    }
    if (playerId === game.round.leader) throw new RoomError('Ведущий не голосует');
    if (game.round.votes[playerId] != null) throw new RoomError('Вы уже проголосовали');
    const next = castVote(game, playerId, slot);
    room.game = next;
    // голоса только от не-ведущих → players.length - 1 когда все проголосовали
    if (next.round && Object.keys(next.round.votes).length === next.players.length - 1) {
      room.game = tallyRound(next);
      this.armTimer(room);
    }
    this.snapshotRoom(room);
  }

  /** Любой игрок завершает scoring-паузу и начинает следующий раунд (или финалит). */
  advance(room: Room, _playerId: string): void {
    const game = room.game;
    if (!game || room.phase !== 'playing') throw new RoomError('Игра не идёт');
    if (!game.round || game.round.phase !== 'scoring') {
      throw new RoomError('Сейчас не фаза подсчёта');
    }
    this.proceedAfterScoring(room);
  }

  // ───────────────────────── таймеры ─────────────────────────

  private dropTimer(room: Room): void {
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    room.turnDeadline = null;
  }

  /**
   * Перевооружает один фазный таймер под текущую round.phase. НЕ снапшотит и
   * НЕ броадкастит — вызывающие методы (submitLeader/start/onTimeout/…) делают
   * snapshot после armTimer. Если игра не активна или round отсутствует —
   * сбрасывает таймер без перевооружения.
   */
  private armTimer(room: Room): void {
    const game = room.game;
    if (!game || game.phase !== 'association' || !game.round) {
      this.dropTimer(room);
      return;
    }
    const phase: ImaginariumRoundPhase = game.round.phase;
    const sec =
      phase === 'association'
        ? room.settings.associationSec
        : phase === 'choosing'
          ? room.settings.choosingSec
          : phase === 'voting'
            ? room.settings.votingSec
            : SCORING_AUTO_SEC; // scoring
    this.dropTimer(room);
    const deadline = Date.now() + sec * 1000;
    room.turnDeadline = deadline;
    const armedPhase = phase;
    const gameRef = game;
    room.timer = setTimeout(() => {
      room.timer = null;
      if (!this.get(room.code) || room.game !== gameRef) return;
      if (room.game.round?.phase !== armedPhase) return;
      this.onTimeout(room, armedPhase);
    }, sec * 1000);
  }

  /**
   * Срабатывание фазного таймера: меняет состояние, перевооружает таймер,
   * снапшотит И броадкастит (хендлер не участвует — менеджер сам информирует
   * клиентов о сервер-инициированной смене состояния).
   */
  private onTimeout(room: Room, phase: ImaginariumRoundPhase): void {
    const game = room.game;
    if (!game || !game.round) return;
    switch (phase) {
      case 'association': {
        // Ведущий не подал ассоциацию — пропускаем раунд целиком.
        room.game = skipRound(game);
        this.armTimer(room);
        this.snapshotRoom(room);
        this.broadcast(room);
        break;
      }
      case 'choosing': {
        // Не-ведущие не сдали карты: если никто не сдал — skipRound,
        // иначе открываем стол с частичным набором и переходим к голосованию.
        const nonLeader = Object.keys(game.round.submissions).length - 1;
        if (nonLeader <= 0) {
          room.game = skipRound(game);
        } else {
          room.game = revealTable(game, Math.random);
        }
        this.armTimer(room);
        this.snapshotRoom(room);
        this.broadcast(room);
        break;
      }
      case 'voting': {
        // Голосование истекло — подсчёт с частичными голосами.
        room.game = tallyRound(game);
        this.armTimer(room);
        this.snapshotRoom(room);
        this.broadcast(room);
        break;
      }
      case 'scoring': {
        // Auto-advance после scoring-паузы.
        this.proceedAfterScoring(room);
        this.broadcast(room);
        break;
      }
    }
  }

  /**
   * Завершает scoring: добирает карты (refillHands), и если игра не окончена —
   * сдвигает ведущего и начинает новый раунд. Если колоды не хватило — игра
   * финалится. НЕ броадкастит: вызывается из advance() (хендлер броадкастит)
   * и из onTimeout('scoring') (броадкастит onTimeout).
   */
  private proceedAfterScoring(room: Room): void {
    const game = room.game;
    if (!game || !game.round || game.round.phase !== 'scoring') return;
    const afterRefill = refillHands(game);
    room.game = afterRefill;
    if (afterRefill.phase === 'finished') {
      room.phase = 'finished';
      this.dropTimer(room);
      this.snapshotRoom(room);
      return;
    }
    room.game = advanceLeader(afterRefill);
    this.armTimer(room);
    this.snapshotRoom(room);
  }

  // ───────────────────────── persist ─────────────────────────

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
      startedAt: room.startedAt,
      turnDeadline: room.turnDeadline,
    };
    void persistSnapshot('imaginarium', room.code, snapshot);
  }

  /**
   * Восстанавливает комнату из Redis-снапшота (аудит §1 restore-on-startup).
   * Реконструирует Room (array → Map для players), перевооружает фазный таймер
   * если игра активна. Все players.connected = false.
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
        settings: snap.settings as ImaginariumRoomSettings,
        players,
        chat: (snap.chat as ChatMessage[]) ?? [],
        game: (snap.game as ImaginariumState | null) ?? null,
        startedAt: (snap.startedAt as number | null) ?? null,
        turnDeadline: (snap.turnDeadline as number | null) ?? null,
        timer: null,
      };
      this.rooms.set(room.code, room);
      // Перевооружаем фазный таймер если игра активна
      if (room.game && room.phase === 'playing') this.armTimer(room);
      return true;
    } catch {
      return false;
    }
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
    connected: true,
  };
}

/** Применяет патч настроек с валидацией границ. */
function patchSettings(patch: ImaginariumSettingsPatch): Partial<ImaginariumRoomSettings> {
  const out: Partial<ImaginariumRoomSettings> = {};
  if (
    typeof patch.associationSec === 'number' &&
    patch.associationSec >= 15 &&
    patch.associationSec <= 180
  ) {
    out.associationSec = patch.associationSec;
  }
  if (
    typeof patch.choosingSec === 'number' &&
    patch.choosingSec >= 15 &&
    patch.choosingSec <= 180
  ) {
    out.choosingSec = patch.choosingSec;
  }
  if (typeof patch.votingSec === 'number' && patch.votingSec >= 15 && patch.votingSec <= 180) {
    out.votingSec = patch.votingSec;
  }
  if (patch.targetScore === null) {
    out.targetScore = null;
  } else if (
    typeof patch.targetScore === 'number' &&
    patch.targetScore >= 10 &&
    patch.targetScore <= 200
  ) {
    out.targetScore = patch.targetScore;
  }
  if (typeof patch.handSize === 'number' && VALID_HAND_SIZES.has(patch.handSize)) {
    out.handSize = patch.handSize;
  }
  return out;
}
