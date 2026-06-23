/**
 * Редакция состояния Imaginarium под конкретного зрителя. Сервер шлёт каждому
 * только видимую им часть: рука — только своя; slots скрыты на voting (открываются
 * на scoring); голоса на voting — только свой, на scoring — все; log на voting
 * не содержит reveal и vote (голоса секретны до подсчёта).
 */
import type { ImaginariumState } from './types';
import type { ImaginariumView, ImaginariumRoundView } from '../events';

export interface ImaginariumViewer {
  /** playerId зрителя. */
  id: string;
}

export function redactImaginarium(
  state: ImaginariumState,
  viewer: ImaginariumViewer,
): ImaginariumView {
  const id = viewer.id;
  const round = state.round;
  const votingLog =
    round != null && round.phase === 'voting'
      ? state.log.filter((e) => e.type !== 'reveal' && e.type !== 'vote')
      : [...state.log];

  let roundView: ImaginariumRoundView | null = null;
  if (round != null) {
    const scoring = round.phase === 'scoring';
    const revealArts = round.phase === 'voting' || round.phase === 'scoring';
    const votes = scoring
      ? { ...round.votes }
      : round.votes[id] != null
        ? { [id]: round.votes[id]! }
        : {};
    roundView = {
      leader: round.leader,
      association: round.association,
      submittedCount: Object.keys(round.submissions).length,
      hasSubmitted: round.submissions[id] != null,
      slots: scoring ? (round.slots ? [...round.slots] : null) : null,
      tableCards: revealArts ? (round.tableCards ? [...round.tableCards] : null) : null,
      votes,
      hasVoted: round.votes[id] != null,
      phase: round.phase,
    };
  }

  return {
    players: [...state.players],
    playerColors: { ...state.playerColors },
    scores: { ...state.scores },
    hand: state.hands[id] ? [...state.hands[id]!] : [],
    handSize: state.handSize,
    deckRemaining: state.deck.length,
    leaderIndex: state.leaderIndex,
    round: roundView,
    roundNumber: state.roundNumber,
    phase: state.phase,
    winner: state.winner ? [...state.winner] : null,
    log: votingLog,
  };
}
