/**
 * Типы Alias. Команды (red/blue) и роли переиспользуем из Коднеймс — это общие
 * сущности для командных игр. Движок чистый: не знает про сокеты, БД и игроков
 * как таковых (explainer — просто строка-id, которую подставляет менеджер).
 */
export type { Team } from '../codenames/types';
import type { Team } from '../codenames/types';

/** Сложность словаря. */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** Фаза партии: лобби → между раундами → раунд → финал. */
export type AliasPhase = 'lobby' | 'between' | 'round' | 'finished';

/** Текущий раунд объяснения. word = null между словами (сигнал «дай следующее»). */
export interface AliasRound {
  word: string | null;
  /** Когда раунд стартовал (ms, Date.now()). Сервер ставит таймер на startedAt + duration. */
  startedAt: number;
  /** Длительность раунда в секундах. */
  duration: number;
  /** Сколько слов угадано в этом раунде. */
  guessed: number;
  /** Сколько слов пропущено в этом раунде. */
  skipped: number;
}

export interface AliasState {
  teams: Team[];
  scores: Record<Team, number>;
  currentTeam: Team;
  /** playerId объясняющего (менеджер назначает по кругу внутри команды); null между раундами. */
  explainer: string | null;
  round: AliasRound | null;
  /** Слова, уже показанные в партии (чтобы не повторять). */
  usedWords: string[];
  targetScore: number;
  difficulty: Difficulty;
  roundDuration: number;
  phase: AliasPhase;
  winner: Team | null;
  log: AliasLogEntry[];
}

export type AliasLogEntry =
  | { type: 'round-start'; team: Team; explainer: string }
  | { type: 'guessed'; team: Team; word: string }
  | { type: 'skipped'; team: Team; word: string }
  | { type: 'round-end'; team: Team; guessed: number; skipped: number }
  | { type: 'gameover'; winner: Team };

export type AliasErrorCode = 'GAME_FINISHED' | 'WRONG_PHASE' | 'NO_ROUND' | 'NO_WORDS';

export class AliasError extends Error {
  readonly code: AliasErrorCode;

  constructor(code: AliasErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'AliasError';
  }
}
