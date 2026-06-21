/** Идентификатор карты. Арт резолвится на фронте (svgCard.ts → data-URL или
 *  public/imaginarium/cards/<id>.webp). Движок знает только id. */
export type CardId = string;

export type ImaginariumPhase =
  | 'lobby'
  | 'association'
  | 'choosing'
  | 'voting'
  | 'scoring'
  | 'finished';

/** Внутри-раундовая фаза (round.phase), пока round != null. */
export type ImaginariumRoundPhase = 'association' | 'choosing' | 'voting' | 'scoring';

export interface ImaginariumRound {
  /** playerId ведущего раунда. */
  leader: string;
  /** Ассоциация ведущего. null до submitLeader. */
  association: string | null;
  /** playerId -> cardId сданной карты (включает ведущего после submitLeader).
   *  Заполняется в choosing. */
  submissions: Record<string, CardId>;
  /** Слоты на столе после перемешивания: slotIndex -> playerId (чей оригинал).
   *  null до revealTable. */
  slots: string[] | null;
  /** Голоса: voterId -> slotIndex. */
  votes: Record<string, number>;
  phase: ImaginariumRoundPhase;
}

export interface ImaginariumState {
  /** Игроки по порядку мест (seat order). */
  players: string[];
  scores: Record<string, number>;
  /** playerId -> карты в руке. Видит только владелец (redact в view). */
  hands: Record<string, CardId[]>;
  /** Оставшаяся колода для добора. */
  deck: CardId[];
  handSize: number;
  /** Индекс ведущего в players. */
  leaderIndex: number;
  round: ImaginariumRound | null;
  roundNumber: number;
  phase: ImaginariumPhase;
  log: ImaginariumLogEntry[];
  /** Победители (может быть несколько при равенстве). null до финиша. */
  winner: string[] | null;
}

export type ImaginariumLogEntry =
  | { type: 'round-start'; leader: string; roundNumber: number }
  | { type: 'association'; leader: string; association: string }
  | { type: 'submitted'; playerId: string }
  | { type: 'reveal'; slots: string[] }
  | { type: 'vote'; voterId: string; slot: number }
  | { type: 'scored'; round: number; deltas: Record<string, number> }
  | { type: 'gameover'; winners: string[] };

export type ImaginariumErrorCode =
  | 'GAME_FINISHED'
  | 'WRONG_PHASE'
  | 'NOT_LEADER'
  | 'NOT_PLAYER'
  | 'ALREADY_SUBMITTED'
  | 'ALREADY_VOTED'
  | 'CARD_NOT_IN_HAND'
  | 'CANNOT_VOTE_OWN_CARD'
  | 'EMPTY_ASSOCIATION'
  | 'DECK_TOO_SMALL'
  | 'INVALID_SLOT'
  | 'INVALID_PLAYERS';

export class ImaginariumError extends Error {
  readonly code: ImaginariumErrorCode;
  constructor(code: ImaginariumErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'ImaginariumError';
  }
}

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;
export const DEFAULT_HAND_SIZE = 6;
