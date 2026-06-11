/** Команда. */
export type Team = 'red' | 'blue';

/** Принадлежность карточки по ключ-карте. */
export type CardOwner = Team | 'neutral' | 'assassin';

export interface Card {
  word: string;
  owner: CardOwner;
  revealed: boolean;
}

export interface Clue {
  word: string;
  count: number;
}

/** Фаза хода: капитан думает → команда отгадывает → игра окончена. */
export type Phase = 'clue' | 'guess' | 'finished';

export type WinReason = 'all-words' | 'assassin';

export type LogEntry =
  | { type: 'clue'; team: Team; clue: Clue }
  | { type: 'guess'; team: Team; cardIndex: number; owner: CardOwner }
  | { type: 'pass'; team: Team }
  | { type: 'gameover'; winner: Team; reason: WinReason };

export interface CodenamesState {
  cards: Card[];
  startingTeam: Team;
  turn: Team;
  phase: Phase;
  clue: Clue | null;
  /** Сколько попыток осталось в текущем ходу (правило «число + 1»). */
  guessesLeft: number;
  winner: Team | null;
  winReason: WinReason | null;
  log: LogEntry[];
}

export type CodenamesErrorCode =
  | 'GAME_FINISHED'
  | 'WRONG_PHASE'
  | 'CARD_ALREADY_REVEALED'
  | 'CARD_OUT_OF_RANGE'
  | 'INVALID_CLUE_WORD'
  | 'INVALID_CLUE_COUNT';

export class CodenamesError extends Error {
  readonly code: CodenamesErrorCode;
  constructor(code: CodenamesErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'CodenamesError';
  }
}
