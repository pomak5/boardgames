/** Вью состояния Uno глазами одного игрока (чужие руки скрыты). */
import { legalPlays } from './engine';
import type { UnoCard, UnoColor, UnoLogEntry, UnoPhase, UnoRules, UnoState } from './types';

export interface UnoPlayerView {
  id: string;
  handCount: number;
  saidUno: boolean;
  score: number;
}

export interface UnoView {
  rules: UnoRules;
  players: UnoPlayerView[];
  /** Своя рука. */
  hand: UnoCard[];
  /** id ходящего. */
  turnPlayerId: string;
  dir: 1 | -1;
  color: UnoColor;
  topCard: UnoCard;
  deckCount: number;
  phase: UnoPhase;
  pendingDraw: number;
  /** id карт, которые зритель может сыграть прямо сейчас (вкл. jump-in). */
  playable: number[];
  /** Можно спасовать (после добора). */
  canPass: boolean;
  /** Уже добирал в этот ход. */
  drewThisTurn: boolean;
  /** id игрока, которого можно поймать на «UNO!». */
  catchablePlayerId: string | null;
  roundWinner: string | null;
  winner: string | null;
  log: UnoLogEntry[];
}

export function redactUno(state: UnoState, playerId: string): UnoView {
  const me = state.players.find((p) => p.id === playerId);
  const isTurn = state.players[state.turn]?.id === playerId;
  return {
    rules: state.rules,
    players: state.players.map((p) => ({
      id: p.id,
      handCount: p.hand.length,
      saidUno: p.saidUno,
      score: p.score,
    })),
    hand: me?.hand ?? [],
    turnPlayerId: (state.players[state.turn] as { id: string }).id,
    dir: state.dir,
    color: state.color,
    topCard: state.discard[state.discard.length - 1] as UnoCard,
    deckCount: state.deck.length,
    phase: state.phase,
    pendingDraw: state.pendingDraw,
    playable: me ? legalPlays(state, playerId) : [],
    canPass:
      !!me &&
      isTurn &&
      state.phase === 'play' &&
      state.drewThisTurn &&
      state.drawnPlayable !== null &&
      !state.rules.forcePlay,
    drewThisTurn: isTurn && state.drewThisTurn,
    catchablePlayerId:
      state.unoVulnerable !== null && state.players[state.unoVulnerable]?.id !== playerId
        ? (state.players[state.unoVulnerable] as { id: string }).id
        : null,
    roundWinner: state.roundWinner,
    winner: state.winner,
    log: state.log.slice(-30),
  };
}
