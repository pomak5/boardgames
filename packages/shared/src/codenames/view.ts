/** Редакция состояния Коднеймс под конкретного зрителя (сервер шлёт только видимое). */
import type { CodenamesState } from './types';
import { score } from './engine';
import type { CodenamesView } from '../events';

export function redactCodenames(state: CodenamesState, seesKey: boolean): CodenamesView {
  return {
    cards: state.cards.map((c) => ({
      word: c.word,
      revealed: c.revealed,
      owner: c.revealed || seesKey ? c.owner : null,
    })),
    turn: state.turn,
    phase: state.phase,
    clue: state.clue,
    guessesLeft: Number.isFinite(state.guessesLeft) ? state.guessesLeft : 'unlimited',
    winner: state.winner,
    winReason: state.winReason,
    remaining: score(state),
    log: state.log,
  };
}
