import type { Clue, LogEntry, Team } from './codenames';

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
}

export type RoomPhase = 'lobby' | 'playing' | 'finished';

export interface RoomView {
  code: string;
  hostId: string;
  phase: RoomPhase;
  settings: RoomSettings;
  players: RoomPlayer[];
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
}
