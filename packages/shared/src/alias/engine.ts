/**
 * Движок Alias: чистые функции перехода состояния. Не лезет в I/O (словарь,
 * таймеры, сокеты) — слова подставляет менеджер параметром, как в Коднеймс.
 *
 * Победа определяется в конце полного круга команд (логика менеджера, т.к.
 * требует знания состава и порядка обхода). Движок лишь фиксирует финал.
 */
import type { AliasLogEntry, AliasRound, AliasState, Difficulty, Team } from './types';
import { AliasError } from './types';

export const TEAMS: readonly Team[] = ['red', 'blue'];

export const DEFAULT_TARGET_SCORE = 30;
export const DEFAULT_ROUND_DURATION = 60;

export interface CreateAliasOptions {
  targetScore?: number;
  difficulty?: Difficulty;
  /** Длительность раунда в секундах. */
  roundDuration?: number;
  startingTeam?: Team;
  random?: () => number;
}

/** Создаёт партию в фазе 'between' — первый раунд запускает startRound. */
export function createAliasGame(options: CreateAliasOptions = {}): AliasState {
  const random = options.random ?? Math.random;
  const startingTeam = options.startingTeam ?? (random() < 0.5 ? 'red' : 'blue');
  return {
    teams: [...TEAMS],
    scores: { red: 0, blue: 0 },
    currentTeam: startingTeam,
    explainer: null,
    round: null,
    usedWords: [],
    targetScore: options.targetScore ?? DEFAULT_TARGET_SCORE,
    difficulty: options.difficulty ?? 'medium',
    roundDuration: options.roundDuration ?? DEFAULT_ROUND_DURATION,
    phase: 'between',
    winner: null,
    log: [],
  };
}

export interface StartRoundParams {
  team: Team;
  /** playerId объясняющего. */
  explainer: string;
  word: string;
  startedAt?: number;
  duration?: number;
}

/** Запускает раунд: ведущий команды объясняет первое слово. */
export function startRound(state: AliasState, params: StartRoundParams): AliasState {
  if (state.phase === 'finished') throw new AliasError('GAME_FINISHED', 'Игра окончена');
  if (state.phase === 'round') throw new AliasError('WRONG_PHASE', 'Раунд ещё идёт');
  const round: AliasRound = {
    word: params.word,
    startedAt: params.startedAt ?? Date.now(),
    duration: params.duration ?? state.roundDuration,
    guessed: 0,
    skipped: 0,
  };
  const log: AliasLogEntry = {
    type: 'round-start',
    team: params.team,
    explainer: params.explainer,
  };
  return {
    ...state,
    currentTeam: params.team,
    explainer: params.explainer,
    round,
    phase: 'round',
    log: [...state.log, log],
  };
}

function requireRound(state: AliasState): AliasRound {
  if (state.phase === 'finished') throw new AliasError('GAME_FINISHED', 'Игра окончена');
  if (state.phase !== 'round' || !state.round) {
    throw new AliasError('WRONG_PHASE', 'Сейчас нет активного раунда');
  }
  if (state.round.word == null) throw new AliasError('NO_ROUND', 'Слово уже обработано');
  return state.round;
}

/**
 * Команда угадала слово: +1 к счёту команды, слово уходит в использованные.
 * nextWord = null (словарь исчерпан) → раунд завершается.
 */
export function markGuessed(state: AliasState, nextWord: string | null): AliasState {
  const round = requireRound(state);
  const word = round.word as string;
  const scores = {
    ...state.scores,
    [state.currentTeam]: state.scores[state.currentTeam] + 1,
  };
  const log: AliasLogEntry = { type: 'guessed', team: state.currentTeam, word };
  const usedWords = [...state.usedWords, word];
  if (nextWord == null) {
    return endRound({ ...state, scores, usedWords, log: [...state.log, log] });
  }
  return {
    ...state,
    scores,
    usedWords,
    log: [...state.log, log],
    round: { ...round, word: nextWord, guessed: round.guessed + 1 },
  };
}

/**
 * Ведущий пропустил слово: −1 к счёту (не ниже 0), слово уходит в использованные.
 * nextWord = null → раунд завершается.
 */
export function markSkipped(state: AliasState, nextWord: string | null): AliasState {
  const round = requireRound(state);
  const word = round.word as string;
  const cur = state.scores[state.currentTeam];
  const scores = {
    ...state.scores,
    [state.currentTeam]: Math.max(0, cur - 1),
  };
  const log: AliasLogEntry = { type: 'skipped', team: state.currentTeam, word };
  const usedWords = [...state.usedWords, word];
  if (nextWord == null) {
    return endRound({ ...state, scores, usedWords, log: [...state.log, log] });
  }
  return {
    ...state,
    scores,
    usedWords,
    log: [...state.log, log],
    round: { ...round, word: nextWord, skipped: round.skipped + 1 },
  };
}

/**
 * Завершает раунд (по таймеру сервера или исчерпанию словаря).
 * Текущее слово (round.word, ещё не обработанное) сгорает: не идёт в зачёт
 * и не помечается использованным — его можно показать снова в другом раунде.
 */
export function endRound(state: AliasState): AliasState {
  if (state.phase === 'finished') throw new AliasError('GAME_FINISHED', 'Игра окончена');
  if (state.phase !== 'round' || !state.round) {
    throw new AliasError('WRONG_PHASE', 'Сейчас нет активного раунда');
  }
  const round = state.round;
  const log: AliasLogEntry = {
    type: 'round-end',
    team: state.currentTeam,
    guessed: round.guessed,
    skipped: round.skipped,
  };
  return {
    ...state,
    round: null,
    explainer: null,
    phase: 'between',
    log: [...state.log, log],
  };
}

/** Финал: фиксирует победителя. Менеджер вызывает после проверки круга и счёта. */
export function finishGame(state: AliasState, winner: Team): AliasState {
  if (state.phase === 'finished') throw new AliasError('GAME_FINISHED', 'Игра уже окончена');
  return {
    ...state,
    phase: 'finished',
    winner,
    round: null,
    explainer: null,
    log: [...state.log, { type: 'gameover', winner }],
  };
}

/** Счёт команд (копия, чтобы не мутировать состояние извне). */
export function aliasScore(state: AliasState): Record<Team, number> {
  return { ...state.scores };
}
