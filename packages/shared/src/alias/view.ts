/**
 * Редакция состояния Alias под конкретного зрителя. Сервер шлёт каждому только
 * видимую ему часть: слово видит объясняющий (и, опционально, соперники для
 * контроля честности); отгадывающие видят только факт раунда и счёт.
 */
import type { AliasState, Team } from './types';
import type { AliasView } from '../events';

export interface AliasViewer {
  /** playerId зрителя. */
  id: string;
  /** Команда зрителя (null — не распределён, напр. гость в лобби). */
  team: Team | null;
  /** true, если зритель — объясняющий в текущем раунде. */
  isExplainer: boolean;
  /** Показывать ли слово соперникам (настройка комнаты). */
  showOpponents: boolean;
}

export function redactAlias(state: AliasState, viewer: AliasViewer): AliasView {
  const seesWord =
    state.phase === 'finished' ||
    viewer.isExplainer ||
    (viewer.team !== null && viewer.team !== state.currentTeam && viewer.showOpponents);
  const round = state.round
    ? {
        word: seesWord ? state.round.word : null,
        startedAt: state.round.startedAt,
        duration: state.round.duration,
        guessed: state.round.guessed,
        skipped: state.round.skipped,
      }
    : null;
  return {
    teams: state.teams,
    scores: state.scores,
    currentTeam: state.currentTeam,
    explainer: state.explainer,
    round,
    usedWords: state.usedWords,
    targetScore: state.targetScore,
    difficulty: state.difficulty,
    roundDuration: state.roundDuration,
    phase: state.phase,
    winner: state.winner,
    log: state.log,
  };
}
