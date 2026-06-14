/** Комнаты Uno в памяти: лобби с правилами, боты, таймер хода, чат. Движок — из @boardgames/shared. */
import { randomUUID } from 'node:crypto';
import {
  botAction,
  callUno,
  catchUno,
  chooseColor,
  choosePlayer,
  createUnoRound,
  DEFAULT_UNO_RULES,
  drawCard,
  generateRoomCode,
  passTurn,
  playCard,
  redactUno,
  resolveChallenge,
  timeoutAction,
} from '@boardgames/shared';
import type {
  ChatMessage,
  RoomPhase,
  UnoAction,
  UnoColor,
  UnoRoomSettings,
  UnoRoomView,
  UnoSettingsPatch,
  UnoState,
  UnoView,
} from '@boardgames/shared';

export class UnoRoomError extends Error {}

interface UnoRoomPlayer {
  id: string;
  token: string;
  nickname: string;
  connected: boolean;
  isBot: boolean;
}

export interface UnoRoom {
  code: string;
  hostId: string;
  phase: RoomPhase;
  settings: UnoRoomSettings;
  players: UnoRoomPlayer[];
  chat: ChatMessage[];
  game: UnoState | null;
  turnDeadline: number | null;
  /** Активный таймер хода/бота (clearTimeout при любой смене состояния). */
  timer: ReturnType<typeof setTimeout> | null;
}

const MAX_CHAT = 100;
const MAX_NICK = 24;
const BOT_DELAY_MS = 1500;
const BOT_NAMES = [
  'Бот Котик',
  'Бот Барсук',
  'Бот Сова',
  'Бот Ёж',
  'Бот Лис',
  'Бот Енот',
  'Бот Хомяк',
  'Бот Бобр',
];

export const DEFAULT_UNO_SETTINGS: UnoRoomSettings = {
  game: 'uno',
  rules: DEFAULT_UNO_RULES,
  maxPlayers: 10,
  timer: { enabled: true, turnSec: 30 },
};

function makePlayer(nickname: string, isBot = false): UnoRoomPlayer {
  const nick = nickname.trim().slice(0, MAX_NICK);
  if (!nick) throw new UnoRoomError('Введите ник');
  return { id: randomUUID(), token: randomUUID(), nickname: nick, connected: true, isBot };
}

function mergeSettings(prev: UnoRoomSettings, patch: UnoSettingsPatch): UnoRoomSettings {
  const next: UnoRoomSettings = {
    game: 'uno',
    rules: { ...prev.rules, ...(patch.rules ?? {}) },
    maxPlayers: Math.min(10, Math.max(2, patch.maxPlayers ?? prev.maxPlayers)),
    timer: { ...prev.timer, ...(patch.timer ?? {}) },
  };
  next.rules.startingCards = Math.min(10, Math.max(5, next.rules.startingCards));
  next.rules.unoPenalty = Math.min(4, Math.max(1, next.rules.unoPenalty));
  return next;
}

export class UnoRoomManager {
  private rooms = new Map<string, UnoRoom>();

  /** broadcast вызывается после ходов бота/таймаута, инициированных сервером (не клиентом). */
  constructor(private broadcast: (room: UnoRoom) => void = () => {}) {}

  get(code: string): UnoRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  private require(code: string): UnoRoom {
    const room = this.get(code);
    if (!room) throw new UnoRoomError('Комната не найдена');
    return room;
  }

  private player(room: UnoRoom, token: string): UnoRoomPlayer {
    const p = room.players.find((p) => p.token === token);
    if (!p) throw new UnoRoomError('Игрок не найден');
    return p;
  }

  private host(room: UnoRoom, token: string): UnoRoomPlayer {
    const p = this.player(room, token);
    if (p.id !== room.hostId) throw new UnoRoomError('Действие доступно только хосту');
    return p;
  }

  createRoom(nickname: string, patch: UnoSettingsPatch): { room: UnoRoom; player: UnoRoomPlayer } {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();
    const player = makePlayer(nickname);
    const room: UnoRoom = {
      code,
      hostId: player.id,
      phase: 'lobby',
      settings: mergeSettings(DEFAULT_UNO_SETTINGS, patch ?? {}),
      players: [player],
      chat: [],
      game: null,
      turnDeadline: null,
      timer: null,
    };
    this.rooms.set(code, room);
    return { room, player };
  }

  joinRoom(code: string, nickname: string): { room: UnoRoom; player: UnoRoomPlayer } {
    const room = this.require(code);
    if (room.phase !== 'lobby') throw new UnoRoomError('Игра уже началась');
    if (room.players.length >= room.settings.maxPlayers)
      throw new UnoRoomError('Комната заполнена');
    const player = makePlayer(nickname);
    room.players.push(player);
    return { room, player };
  }

  rejoin(code: string, token: string): { room: UnoRoom; player: UnoRoomPlayer } {
    const room = this.require(code);
    const player = this.player(room, token);
    player.connected = true;
    return { room, player };
  }

  /** Возвращает true, если комната удалена (не осталось живых людей). */
  leave(room: UnoRoom, playerId: string): boolean {
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return false;
    if (room.phase === 'lobby') room.players = room.players.filter((p) => p.id !== playerId);
    else player.connected = false;
    const humans = room.players.filter((p) => !p.isBot);
    if (humans.length === 0 || (room.phase !== 'lobby' && !humans.some((p) => p.connected))) {
      this.clearTimer(room);
      this.rooms.delete(room.code);
      return true;
    }
    if (room.hostId === playerId) room.hostId = humans[0]!.id;
    return false;
  }

  addBot(room: UnoRoom, token: string): void {
    this.host(room, token);
    if (room.phase !== 'lobby') throw new UnoRoomError('Игра уже началась');
    if (room.players.length >= room.settings.maxPlayers)
      throw new UnoRoomError('Комната заполнена');
    const used = new Set(room.players.map((p) => p.nickname));
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Бот №${room.players.length}`;
    room.players.push(makePlayer(name, true));
  }

  removeBot(room: UnoRoom, token: string, botId: string): void {
    this.host(room, token);
    if (room.phase !== 'lobby') throw new UnoRoomError('Игра уже началась');
    room.players = room.players.filter((p) => !(p.isBot && p.id === botId));
  }

  updateSettings(room: UnoRoom, token: string, patch: UnoSettingsPatch): void {
    this.host(room, token);
    if (room.phase !== 'lobby') throw new UnoRoomError('Игра уже началась');
    room.settings = mergeSettings(room.settings, patch);
  }

  start(room: UnoRoom, token: string): void {
    this.host(room, token);
    if (room.phase !== 'lobby') throw new UnoRoomError('Игра уже началась');
    if (room.players.length < 2)
      throw new UnoRoomError('Нужно минимум 2 игрока (добавьте бота)');
    room.game = createUnoRound(
      room.players.map((p) => p.id),
      room.settings.rules,
      {},
      Math.floor(Math.random() * room.players.length),
    );
    room.phase = 'playing';
    this.afterUpdate(room);
  }

  nextRound(room: UnoRoom, token: string): void {
    this.host(room, token);
    const game = room.game;
    if (game?.phase !== 'roundEnd') throw new UnoRoomError('Раунд ещё не закончен');
    const scores: Record<string, number> = {};
    for (const p of game.players) scores[p.id] = p.score;
    const winnerIdx = game.players.findIndex((p) => p.id === game.roundWinner);
    room.game = createUnoRound(
      game.players.map((p) => p.id),
      room.settings.rules,
      scores,
      (winnerIdx + 1) % game.players.length,
    );
    this.afterUpdate(room);
  }

  newGame(room: UnoRoom, token: string): void {
    this.host(room, token);
    if (room.phase !== 'finished') throw new UnoRoomError('Игра ещё не закончена');
    this.clearTimer(room);
    room.game = null;
    room.phase = 'lobby';
    room.turnDeadline = null;
  }

  act(room: UnoRoom, token: string, action: UnoAction): void {
    const player = this.player(room, token);
    const game = room.game;
    if (!game || room.phase !== 'playing') throw new UnoRoomError('Игра не идёт');
    let next: UnoState;
    switch (action.type) {
      case 'play':
        next = playCard(game, player.id, action.cardId, action.declareUno ?? false);
        break;
      case 'draw':
        next = drawCard(game, player.id);
        break;
      case 'pass':
        next = passTurn(game, player.id);
        break;
      case 'chooseColor':
        next = chooseColor(game, player.id, action.color as UnoColor);
        break;
      case 'choosePlayer':
        next = choosePlayer(game, player.id, action.targetId);
        break;
      case 'challenge':
        next = resolveChallenge(game, player.id, action.accept);
        break;
      case 'uno':
        next = callUno(game, player.id);
        break;
      case 'catch':
        next = catchUno(game, player.id);
        break;
      default:
        throw new UnoRoomError('Неизвестное действие');
    }
    room.game = next;
    // «UNO!» и поимка не меняют очередь — таймер не трогаем
    if (action.type !== 'uno' && action.type !== 'catch') this.afterUpdate(room);
  }

  addChat(room: UnoRoom, token: string, text: string): ChatMessage {
    const player = this.player(room, token);
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed) throw new UnoRoomError('Пустое сообщение');
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

  viewFor(room: UnoRoom, playerId: string): UnoView | null {
    return room.game ? redactUno(room.game, playerId) : null;
  }

  roomView(room: UnoRoom): UnoRoomView {
    return {
      code: room.code,
      hostId: room.hostId,
      phase: room.phase,
      settings: room.settings,
      players: room.players.map(({ token: _t, ...p }) => p),
    };
  }

  // ───────────────────────── таймеры / боты ─────────────────────────

  private clearTimer(room: UnoRoom): void {
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
  }

  /** Текущий игрок-бот (если сейчас его ход в активной партии), иначе null. */
  private currentBot(room: UnoRoom): UnoRoomPlayer | null {
    const game = room.game;
    if (!game || game.phase === 'finished' || game.phase === 'roundEnd') return null;
    const current = game.players[game.turn];
    const p = room.players.find((pl) => pl.id === current?.id);
    return p?.isBot ? p : null;
  }

  /**
   * После любой смены состояния: финал/таймер/планирование хода бота.
   * Боты и таймаут планируются через setTimeout и по срабатыванию вызывают broadcast.
   */
  afterUpdate(room: UnoRoom): void {
    this.clearTimer(room);
    const game = room.game;
    if (!game || room.phase !== 'playing') {
      room.turnDeadline = null;
      return;
    }
    if (game.phase === 'finished') {
      room.phase = 'finished';
      room.turnDeadline = null;
      return;
    }
    if (game.phase === 'roundEnd') {
      room.turnDeadline = null;
      return;
    }
    if (this.currentBot(room)) {
      room.turnDeadline = null;
      room.timer = setTimeout(() => this.runBot(room), BOT_DELAY_MS);
      return;
    }
    if (!room.settings.timer.enabled) {
      room.turnDeadline = null;
      return;
    }
    const turnMs = room.settings.timer.turnSec * 1000;
    room.turnDeadline = Date.now() + turnMs;
    room.timer = setTimeout(() => this.runTimeout(room), turnMs);
  }

  /** Один ход бота (для тестов — синхронно; в проде вызывается из таймера). */
  stepBot(room: UnoRoom): boolean {
    if (!this.currentBot(room) || !room.game) return false;
    room.game = botAction(room.game);
    return true;
  }

  /** Один автоход по таймауту (для тестов — синхронно). */
  stepTimeout(room: UnoRoom): boolean {
    const game = room.game;
    if (!game || game.phase === 'finished' || game.phase === 'roundEnd') return false;
    room.game = timeoutAction(game);
    return true;
  }

  private runBot(room: UnoRoom): void {
    if (!this.rooms.has(room.code)) return;
    if (!this.stepBot(room)) return;
    this.afterUpdate(room);
    this.broadcast(room);
  }

  private runTimeout(room: UnoRoom): void {
    if (!this.rooms.has(room.code)) return;
    if (!this.stepTimeout(room)) return;
    this.afterUpdate(room);
    this.broadcast(room);
  }
}
