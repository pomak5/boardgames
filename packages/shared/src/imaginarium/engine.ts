/**
 * Движок Imaginarium: чистые функции перехода состояния. Не лезет в I/O (сокеты,
 * БД, арты карт) — колода CardId подставляется менеджером, random инжектируется.
 *
 * В этой задаче реализован только createImaginariumGame — остальные переходы
 * (submitLeader, submitCard, revealTable, vote, scoreRound, finishGame) будут
 * добавлены позже.
 */
import type { CardId, ImaginariumState } from './types';
import { DEFAULT_HAND_SIZE, ImaginariumError, MAX_PLAYERS, MIN_PLAYERS } from './types';

export interface CreateImaginariumOptions {
  playerIds: string[]; // 3..6
  /** Полная колода CardId (менеджер собирает из арт-набора); движок мешает и раздаёт. */
  deck: CardId[];
  handSize?: number; // default DEFAULT_HAND_SIZE (6)
  random?: () => number;
}

/** Fisher-Yates shuffle (копия массива, не мутирует вход). */
function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export function createImaginariumGame(opts: CreateImaginariumOptions): ImaginariumState {
  const { playerIds, deck } = opts;
  const handSize = opts.handSize ?? DEFAULT_HAND_SIZE;
  const random = opts.random ?? Math.random;

  // Валидация количества игроков
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) {
    throw new ImaginariumError(
      'INVALID_PLAYERS',
      `Игроков должно быть от ${MIN_PLAYERS} до ${MAX_PLAYERS}, получено ${playerIds.length}`,
    );
  }

  // Валидация дубликатов
  if (new Set(playerIds).size !== playerIds.length) {
    throw new ImaginariumError('INVALID_PLAYERS', 'playerIds содержат дубликаты');
  }

  // Валидация размера колоды
  const need = handSize * playerIds.length;
  if (deck.length < need) {
    throw new ImaginariumError(
      'DECK_TOO_SMALL',
      `Колода слишком мала: нужно ${need} карт, есть ${deck.length}`,
    );
  }

  // Перемешать копию колоды и раздать
  const shuffled = shuffle(deck, random);
  const hands: Record<string, CardId[]> = {};
  let cursor = 0;
  for (const p of playerIds) {
    hands[p] = shuffled.slice(cursor, cursor + handSize);
    cursor += handSize;
  }
  const remaining = shuffled.slice(cursor);

  const scores: Record<string, number> = {};
  for (const p of playerIds) scores[p] = 0;

  return {
    players: [...playerIds],
    scores,
    hands,
    deck: remaining,
    handSize,
    leaderIndex: 0,
    round: {
      leader: playerIds[0]!,
      association: null,
      submissions: {},
      slots: null,
      votes: {},
      phase: 'association',
    },
    roundNumber: 1,
    phase: 'association',
    log: [{ type: 'round-start', leader: playerIds[0]!, roundNumber: 1 }],
    winner: null,
  };
}
