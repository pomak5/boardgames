/**
 * Движок Imaginarium: чистые функции перехода состояния. Не лезет в I/O (сокеты,
 * БД, арты карт) — колода CardId подставляется менеджером, random инжектируется.
 *
 * В этой задаче реализован только createImaginariumGame — остальные переходы
 * (submitLeader, submitCard, revealTable, vote, scoreRound, finishGame) будут
 * добавлены позже.
 */
import type { CardId, ImaginariumLogEntry, ImaginariumState } from './types';
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

/**
 * Ведущий раунда сдаёт свою карту + ассоциацию, переводя round.phase
 * из 'association' в 'choosing'. Внешний state.phase остаётся 'association'.
 */
export function submitLeader(
  state: ImaginariumState,
  leaderId: string,
  cardId: CardId,
  association: string,
): ImaginariumState {
  if (state.phase === 'finished') {
    throw new ImaginariumError('GAME_FINISHED', 'Игра завершена');
  }
  if (state.phase !== 'association' || state.round == null || state.round.phase !== 'association') {
    throw new ImaginariumError('WRONG_PHASE', 'Сейчас нельзя подать ассоциацию');
  }
  if (leaderId !== state.round.leader) {
    throw new ImaginariumError('NOT_LEADER', 'Вы не ведущий этого раунда');
  }
  if (association.trim().length === 0) {
    throw new ImaginariumError('EMPTY_ASSOCIATION', 'Ассоциация не может быть пустой');
  }
  if (!state.hands[leaderId]?.includes(cardId)) {
    throw new ImaginariumError('CARD_NOT_IN_HAND', 'Этой карты нет в руке ведущего');
  }

  const submissions = { ...state.round.submissions, [leaderId]: cardId };
  const newHand = state.hands[leaderId]!.filter((c) => c !== cardId);
  const entry: ImaginariumLogEntry = { type: 'association', leader: leaderId, association };

  return {
    ...state,
    hands: { ...state.hands, [leaderId]: newHand },
    round: {
      ...state.round,
      association,
      submissions,
      phase: 'choosing',
    },
    log: [...state.log, entry],
  };
}

/**
 * Не-ведущий игрок сдаёт одну из своих карт во время 'choosing'.
 * round.phase остаётся 'choosing' (в 'voting' переводит revealTable позже).
 */
export function submitCard(
  state: ImaginariumState,
  playerId: string,
  cardId: CardId,
): ImaginariumState {
  if (state.phase === 'finished') {
    throw new ImaginariumError('GAME_FINISHED', 'Игра завершена');
  }
  if (state.phase !== 'association' || state.round == null || state.round.phase !== 'choosing') {
    throw new ImaginariumError('WRONG_PHASE', 'Сейчас нельзя сдать карту');
  }
  if (!state.players.includes(playerId)) {
    throw new ImaginariumError('NOT_PLAYER', 'Вы не участник игры');
  }
  if (playerId === state.round.leader) {
    throw new ImaginariumError('ALREADY_SUBMITTED', 'Ведущий уже сдал карту');
  }
  if (state.round.submissions[playerId] != null) {
    throw new ImaginariumError('ALREADY_SUBMITTED', 'Вы уже сдали карту в этом раунде');
  }
  if (!state.hands[playerId]?.includes(cardId)) {
    throw new ImaginariumError('CARD_NOT_IN_HAND', 'Этой карты нет в вашей руке');
  }

  const submissions = { ...state.round.submissions, [playerId]: cardId };
  const newHand = state.hands[playerId]!.filter((c) => c !== cardId);
  const entry: ImaginariumLogEntry = { type: 'submitted', playerId };

  return {
    ...state,
    hands: { ...state.hands, [playerId]: newHand },
    round: {
      ...state.round,
      submissions,
    },
    log: [...state.log, entry],
  };
}
