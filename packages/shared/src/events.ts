import type { Clue, LogEntry, Team } from './codenames';
import type { UnoColor, UnoRules, UnoView } from './uno';

export type GameId = 'codenames' | 'uno' | 'alias';

export type PlayerRole = 'captain' | 'guesser';

export interface RoomPlayer {
  id: string;
  nickname: string;
  team: Team | null;
  role: PlayerRole;
  connected: boolean;
}

export interface RoomSettings {
  game: GameId;
  /** Бот-капитан для каждой команды (если выключен — капитаном должен стать игрок). */
  botCaptains: Record<Team, boolean>;
  botRisk: 'cautious' | 'normal' | 'bold';
  /** Настройка таймера хода (опционально; по умолчанию включён, 60с). */
  timer?: {
    enabled: boolean;
    turnSec: number;
    /** Время первого хода (обычно двойное). */
    firstTurnSec?: number;
    /** Бонус секунд за каждое угаданное слово. */
    bonusSec?: number;
  };
}

export type RoomPhase = 'lobby' | 'playing' | 'finished';

export interface RoomView {
  code: string;
  hostId: string;
  phase: RoomPhase;
  settings: RoomSettings;
  players: RoomPlayer[];
  /** Счёт серии в комнате (опционально). */
  series?: Record<Team, number>;
  /** Когда началась текущая партия (ms, Date.now()); null в лобби. Для счётчика времени игры. */
  startedAt?: number | null;
}

export interface ChatMessage {
  authorId: string;
  authorName: string;
  text: string;
  sentAt: number;
}

/** Карточка глазами конкретного игрока: owner скрыт, пока слово не открыто (капитан видит всё). */
export interface CodenamesCardView {
  word: string;
  revealed: boolean;
  owner: 'red' | 'blue' | 'neutral' | 'assassin' | null;
}

export interface CodenamesView {
  cards: CodenamesCardView[];
  turn: Team;
  phase: 'clue' | 'guess' | 'finished';
  clue: Clue | null;
  /** 'unlimited' вместо Infinity (JSON не умеет Infinity). */
  guessesLeft: number | 'unlimited';
  winner: Team | null;
  winReason: 'all-words' | 'assassin' | null;
  remaining: Record<Team, number>;
  log: LogEntry[];
}

export interface JoinAck {
  ok: boolean;
  error?: string;
  room?: RoomView;
  playerId?: string;
  token?: string;
}

/** События сервер → клиент. */
export interface ServerToClientEvents {
  'room:state': (room: RoomView) => void;
  'room:closed': (reason: string) => void;
  'chat:message': (msg: ChatMessage) => void;
  'chat:history': (msgs: ChatMessage[]) => void;
  'game:state': (view: CodenamesView) => void;
  /** Дедлайн текущего хода (ms, Date.now()) или null, если таймер выключен. */
  'game:timer': (deadline: number | null) => void;
  'game:error': (message: string) => void;
}

/** События клиент → сервер. */
export interface ClientToServerEvents {
  'room:create': (nickname: string, settings: RoomSettings, ack: (a: JoinAck) => void) => void;
  'room:join': (code: string, nickname: string, ack: (a: JoinAck) => void) => void;
  'room:rejoin': (code: string, token: string, ack: (a: JoinAck) => void) => void;
  'room:leave': () => void;
  'room:setTeam': (team: Team, role: PlayerRole) => void;
  'room:settings': (settings: RoomSettings) => void;
  'room:start': () => void;
  'chat:send': (text: string) => void;
  'game:clue': (clue: Clue) => void;
  'game:guess': (cardIndex: number) => void;
  'game:pass': () => void;
  'room:newRound': () => void;
}

// ============================ Uno ============================

export interface UnoRoomPlayerView {
  id: string;
  nickname: string;
  connected: boolean;
  isBot: boolean;
}

export interface UnoRoomSettings {
  game: 'uno';
  rules: UnoRules;
  maxPlayers: number;
  timer: { enabled: boolean; turnSec: number };
}

export interface UnoRoomView {
  code: string;
  hostId: string;
  phase: RoomPhase;
  settings: UnoRoomSettings;
  players: UnoRoomPlayerView[];
}

export type UnoAction =
  | { type: 'play'; cardId: number; declareUno?: boolean }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'chooseColor'; color: UnoColor }
  | { type: 'choosePlayer'; targetId: string }
  | { type: 'challenge'; accept: boolean }
  | { type: 'uno' }
  | { type: 'catch' };

export interface UnoJoinAck {
  ok: boolean;
  error?: string;
  room?: UnoRoomView;
  playerId?: string;
  token?: string;
}

/** Изменяемые хостом настройки комнаты Uno (глубоко-частичные). */
export interface UnoSettingsPatch {
  rules?: Partial<UnoRules>;
  maxPlayers?: number;
  timer?: Partial<{ enabled: boolean; turnSec: number }>;
}

/** События сервер → клиент (namespace /uno). */
export interface UnoServerToClientEvents {
  'room:state': (room: UnoRoomView) => void;
  'room:closed': (reason: string) => void;
  'chat:message': (msg: ChatMessage) => void;
  'chat:history': (msgs: ChatMessage[]) => void;
  'game:state': (view: UnoView) => void;
  'game:timer': (deadline: number | null) => void;
  'game:error': (message: string) => void;
}

/** События клиент → сервер (namespace /uno). */
export interface UnoClientToServerEvents {
  'room:create': (
    nickname: string,
    settings: UnoSettingsPatch,
    ack: (a: UnoJoinAck) => void,
  ) => void;
  'room:join': (code: string, nickname: string, ack: (a: UnoJoinAck) => void) => void;
  'room:rejoin': (code: string, token: string, ack: (a: UnoJoinAck) => void) => void;
  'room:leave': () => void;
  'room:settings': (settings: UnoSettingsPatch) => void;
  'room:addBot': () => void;
  'room:removeBot': (botId: string) => void;
  'room:start': () => void;
  'room:nextRound': () => void;
  'room:newGame': () => void;
  'game:act': (action: UnoAction) => void;
  'chat:send': (text: string) => void;
}