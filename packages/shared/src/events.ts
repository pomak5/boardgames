import type { Clue, LogEntry, Team } from './codenames';
import type { AliasLogEntry, AliasPhase, Difficulty, AliasRound } from './alias';
import type { UnoColor, UnoRules, UnoView } from './uno';
import type {
  CardId,
  ImaginariumLogEntry,
  ImaginariumPhase,
  ImaginariumRoundPhase,
} from './imaginarium';

export type GameId = 'codenames' | 'uno' | 'alias' | 'imaginarium';

export type PlayerRole = 'captain' | 'guesser';

export interface RoomPlayer {
  id: string;
  nickname: string;
  /** data:image/* URL аватара из профиля (null у гостей и без аватара). */
  avatarUrl: string | null;
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
  /** Управление слотом капитана команды: сесть самому / поставить бота / освободить. */
  'room:setCaptain': (team: Team, who: 'me' | 'bot' | 'open') => void;
  'room:settings': (settings: RoomSettings) => void;
  'room:start': () => void;
  'chat:send': (text: string) => void;
  'game:clue': (clue: Clue) => void;
  'game:guess': (cardIndex: number) => void;
  'game:pass': () => void;
  'room:newRound': () => void;
}

// ============================ Alias ============================

export interface AliasRoomPlayerView {
  id: string;
  nickname: string;
  /** data:image/* URL аватара из профиля (null у гостей). */
  avatarUrl: string | null;
  team: Team | null;
  role: PlayerRole;
  connected: boolean;
}

export interface AliasRoomSettings {
  game: 'alias';
  difficulty: Difficulty;
  /** Длительность раунда в секундах: 30 / 60 / 90. */
  roundDuration: number;
  /** Победный счёт. */
  targetScore: number;
  /** Показывать слово ведущего соперникам (контроль честности). */
  showOpponents: boolean;
}

export interface AliasRoomView {
  code: string;
  hostId: string;
  phase: RoomPhase;
  settings: AliasRoomSettings;
  players: AliasRoomPlayerView[];
  startedAt?: number | null;
}

export interface AliasView {
  teams: Team[];
  scores: Record<Team, number>;
  currentTeam: Team;
  explainer: string | null;
  round: (Omit<AliasRound, 'word'> & { word: string | null }) | null;
  usedWords: string[];
  targetScore: number;
  difficulty: Difficulty;
  roundDuration: number;
  phase: AliasPhase;
  winner: Team | null;
  log: AliasLogEntry[];
}

export interface AliasJoinAck {
  ok: boolean;
  error?: string;
  room?: AliasRoomView;
  playerId?: string;
  token?: string;
}

/** Настройки комнаты, которые хост может менять (все поля опциональны). */
export interface AliasSettingsPatch {
  difficulty?: Difficulty;
  roundDuration?: number;
  targetScore?: number;
  showOpponents?: boolean;
}

export interface AliasServerToClientEvents {
  'room:state': (room: AliasRoomView) => void;
  'room:closed': (reason: string) => void;
  'chat:message': (msg: ChatMessage) => void;
  'chat:history': (msgs: ChatMessage[]) => void;
  'game:state': (view: AliasView) => void;
  /** Дедлайн текущего раунда (ms, Date.now()) или null. */
  'game:timer': (deadline: number | null) => void;
  'game:error': (message: string) => void;
}

export interface AliasClientToServerEvents {
  'room:create': (
    nickname: string,
    settings: AliasSettingsPatch,
    ack: (a: AliasJoinAck) => void,
  ) => void;
  'room:join': (code: string, nickname: string, ack: (a: AliasJoinAck) => void) => void;
  'room:rejoin': (code: string, token: string, ack: (a: AliasJoinAck) => void) => void;
  'room:leave': () => void;
  'room:setTeam': (team: Team, role: PlayerRole) => void;
  'room:settings': (settings: AliasSettingsPatch) => void;
  'room:start': () => void;
  'room:newRound': () => void;
  'chat:send': (text: string) => void;
  'game:guessed': () => void;
  'game:skipped': () => void;
}

// ============================ Uno ============================

export interface UnoRoomPlayerView {
  id: string;
  nickname: string;
  /** data:image/* URL аватара из профиля (null у гостей/ботов). */
  avatarUrl: string | null;
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

// ============================ Imaginarium ============================

/** Раунд глазами конкретного зрителя: submittedCount публичен, slots/votes
 *  редуцированы до scoring-фазы, hasSubmitted/hasVoted — про зрителя. */
export interface ImaginariumRoundView {
  leader: string;
  association: string | null;
  /** Сколько карт сдано на стол (публично). */
  submittedCount: number;
  /** Сдал ли ЗРИТЕЛЬ свою карту в этом раунде. */
  hasSubmitted: boolean;
  /** slotIndex -> playerId (чей оригинал). null до scoring (на voting скрыто). */
  slots: string[] | null;
  /** Голоса. На voting — только свой (одна запись); на scoring — все. */
  votes: Record<string, number>;
  /** Проголосовал ли ЗРИТЕЛЬ. */
  hasVoted: boolean;
  phase: ImaginariumRoundPhase;
}

/** Состояние партии глазами конкретного зрителя: рука только своя, раунд
 *  редуцирован (см. ImaginariumRoundView), log редуцирован на voting. */
export interface ImaginariumView {
  players: string[];
  scores: Record<string, number>;
  /** Только моя рука (копия); [] для не-игрока. */
  hand: CardId[];
  handSize: number;
  leaderIndex: number;
  round: ImaginariumRoundView | null;
  roundNumber: number;
  phase: ImaginariumPhase;
  winner: string[] | null;
  log: ImaginariumLogEntry[];
}

export interface ImaginariumRoomSettings {
  game: 'imaginarium';
  /** Длительность фазы ведущего (карта + ассоциация), сек. */
  associationSec: number;
  /** Длительность фазы выбора карт, сек. */
  choosingSec: number;
  /** Длительность голосования, сек. */
  votingSec: number;
  /** Ранний финиш по целевому счёту (null — только по исчерпанию колоды). */
  targetScore: number | null;
  /** Размер руки (канон 6). */
  handSize: number;
}

export interface ImaginariumRoomPlayerView {
  id: string;
  nickname: string;
  /** data:image/* URL аватара из профиля (null у гостей). */
  avatarUrl: string | null;
  connected: boolean;
}

export interface ImaginariumRoomView {
  code: string;
  hostId: string;
  phase: RoomPhase;
  settings: ImaginariumRoomSettings;
  players: ImaginariumRoomPlayerView[];
  startedAt?: number | null;
}

export interface ImaginariumJoinAck {
  ok: boolean;
  error?: string;
  room?: ImaginariumRoomView;
  playerId?: string;
  token?: string;
}

/** Настройки комнаты, которые хост может менять (все поля опциональны). */
export interface ImaginariumSettingsPatch {
  associationSec?: number;
  choosingSec?: number;
  votingSec?: number;
  targetScore?: number | null;
  handSize?: number;
}

export interface ImaginariumServerToClientEvents {
  'room:state': (room: ImaginariumRoomView) => void;
  'room:closed': (reason: string) => void;
  'chat:message': (msg: ChatMessage) => void;
  'chat:history': (msgs: ChatMessage[]) => void;
  'game:state': (view: ImaginariumView) => void;
  /** Дедлайн текущей фазы (ms, Date.now()) или null. */
  'game:timer': (deadline: number | null) => void;
  'game:error': (message: string) => void;
}

export interface ImaginariumClientToServerEvents {
  'room:create': (
    nickname: string,
    settings: ImaginariumSettingsPatch,
    ack: (a: ImaginariumJoinAck) => void,
  ) => void;
  'room:join': (code: string, nickname: string, ack: (a: ImaginariumJoinAck) => void) => void;
  'room:rejoin': (code: string, token: string, ack: (a: ImaginariumJoinAck) => void) => void;
  'room:leave': () => void;
  'room:settings': (settings: ImaginariumSettingsPatch) => void;
  'room:start': () => void;
  'room:newRound': () => void;
  'chat:send': (text: string) => void;
  'game:leader': (cardId: CardId, association: string) => void;
  'game:submit': (cardId: CardId) => void;
  'game:vote': (slot: number) => void;
  'game:advance': () => void;
}
