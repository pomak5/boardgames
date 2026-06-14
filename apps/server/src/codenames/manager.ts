/** Комнаты в памяти: создание/вход по коду, команды, запуск Коднеймс, ходы. */
import { randomUUID } from 'node:crypto';
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
  suggestClue,
} from '@boardgames/shared';
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

  createRoom(nickname: string, settings: RoomSettings): { room: Room; player: PlayerRecord } {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();
    const player = makePlayer(nickname);
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
    };
    this.rooms.set(code, room);
    return { room, player };
  }

  joinRoom(code: string, nickname: string): { room: Room; player: PlayerRecord } {
    const room = this.get(code);
    if (!room) throw new RoomError('Комната не найдена');
    if (room.phase !== 'lobby') throw new RoomError('Игра уже началась');
    if (room.players.size >= MAX_PLAYERS) throw new RoomError('Комната заполнена');
    const player = makePlayer(nickname);
    room.players.set(player.id, player);
    return { room, player };
  }

  rejoin(code: string, token: string): { room: Room; player: PlayerRecord } {
    const room = this.get(code);
    if (!room) throw new RoomError('Комната не найдена');
    const player = [...room.players.values()].find((p) => p.token === token);
    if (!player) throw new RoomError('Игрок не найден');
    player.connected = true;
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
      this.rooms.delete(room.code);
      return true;
    }
    if (room.hostId === playerId && room.players.size > 0) {
      const next = [...room.players.values()][0];
      if (next) room.hostId = next.id;
    }
    return false;
  }

  setTeam(room: Room, playerId: string, team: Team, role: PlayerRole): void {
    if (room.phase !== 'lobby') throw new RoomError('Состав можно менять только в лобби');
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
  }

  updateSettings(room: Room, playerId: string, settings: RoomSettings): void {
    if (playerId !== room.hostId) throw new RoomError('Настройки меняет только хост');
    if (room.phase !== 'lobby') throw new RoomError('Игра уже началась');
    room.settings = { ...room.settings, ...settings, game: 'codenames' };
    // если команде включили бот-капитана — снимаем человеческого
    for (const p of room.players.values()) {
      if (p.team && p.role === 'captain' && room.settings.botCaptains[p.team]) p.role = 'guesser';
    }
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
  }

  giveClue(room: Room, playerId: string, clue: Clue): void {
    const { game, player } = this.requireGame(room, playerId);
    if (player.team !== game.turn || player.role !== 'captain')
      throw new RoomError('Сейчас подсказку даёт капитан другой команды');
    room.game = giveClue(game, clue);
  }

  /** Подсказка бота-капитана для текущей команды (вызывается сервером). */
  botClue(room: Room): boolean {
    const game = room.game;
    if (!game || game.phase !== 'clue' || !room.settings.botCaptains[game.turn]) return false;
    const trace = suggestClue(game, game.turn, room.settings.botRisk);
    if (!trace) return false; // у команды нет закрытых слов — не бывает в фазе clue
    room.game = giveClue(game, trace.clue);
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
  }

  pass(room: Room, playerId: string): void {
    const { game, player } = this.requireGame(room, playerId);
    if (player.team !== game.turn || player.role !== 'guesser')
      throw new RoomError('Сейчас ходит другая команда');
    room.game = pass(game);
  }

  /** Тайм-аут фазы отгадывания: ход переходит (сервер, без игрока). */
  timeoutPass(room: Room): void {
    if (!room.game || room.phase !== 'playing' || room.game.phase !== 'guess') return;
    room.game = pass(room.game);
  }

  /** Тайм-аут капитана: подсказка не дана, ход переходит другой команде. */
  timeoutSkipClue(room: Room): void {
    if (!room.game || room.phase !== 'playing' || room.game.phase !== 'clue') return;
    room.game = skipClue(room.game);
  }

  /** Новый раунд: комната возвращается в лобби, игроки и счёт серии остаются. */
  newRound(room: Room, playerId: string): void {
    if (playerId !== room.hostId) throw new RoomError('Новый раунд начинает хост');
    if (room.phase !== 'finished') throw new RoomError('Игра ещё не закончена');
    room.game = null;
    room.phase = 'lobby';
    room.botPending = false;
    room.startedAt = null;
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

function makePlayer(nickname: string): PlayerRecord {
  const nick = nickname.trim().slice(0, MAX_NICK);
  if (!nick) throw new RoomError('Введите ник');
  return {
    id: randomUUID(),
    token: randomUUID(),
    nickname: nick,
    team: null,
    role: 'guesser',
    connected: true,
  };
}
