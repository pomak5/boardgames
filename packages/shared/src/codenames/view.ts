/** Редакция состояния Коднеймс под конкретного зрителя (сервер шлёт только видимое). */
import type { CodenamesState } from './types';
import { score } from './engine';
import type { CodenamesView } from '../events';

/** Лимит лога хода в view (на провод). Партия конечна (~25 карточек + подсказки),
 *  но длинной серии без rematch лог мог бы расти без ограничений (аудит §10). */
const MAX_LOG = 60;

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
    guessesLeft: state.guessesLeft === null ? 'unlimited' : state.guessesLeft,
    winner: state.winner,
    winReason: state.winReason,
    remaining: score(state),
    log: state.log.slice(-MAX_LOG),
  };
}
