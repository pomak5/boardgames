/**
 * Движок Imaginarium: чистые функции перехода состояния. Не лезет в I/O (сокеты,
 * БД, арты карт) — колода CardId подставляется менеджером, random инжектируется.
 *
 * В этой задаче реализован только createImaginariumGame — остальные переходы
 * (submitLeader, submitCard, revealTable, vote, scoreRound, finishGame) будут
 * добавлены позже.
 */
import type { CardId, ImaginariumLogEntry, ImaginariumRound, ImaginariumState } from './types';
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

/**
 * Завершает фазу выбора: перемешивает сданные карты в пронумерованные слоты
 * стола и переводит round.phase из 'choosing' в 'voting'. Допускает частичные
 * подачи (таймаут). Внешний state.phase остаётся 'association'.
 */
export function revealTable(state: ImaginariumState, random?: () => number): ImaginariumState {
  const r = random ?? Math.random;

  if (state.phase === 'finished') {
    throw new ImaginariumError('GAME_FINISHED', 'Игра завершена');
  }
  if (state.phase !== 'association' || state.round == null || state.round.phase !== 'choosing') {
    throw new ImaginariumError('WRONG_PHASE', 'Сейчас нельзя открыть стол');
  }

  const playerIds = Object.keys(state.round.submissions);
  const slots = shuffle(playerIds, r);
  const entry: ImaginariumLogEntry = { type: 'reveal', slots };

  return {
    ...state,
    round: {
      ...state.round,
      slots,
      phase: 'voting',
    },
    log: [...state.log, entry],
  };
}

/**
 * Не-ведущий игрок голосует за слот стола (карту, которую считает картой
 * ведущего). Нельзя голосовать за свой собственный слот. round.phase остаётся
 * 'voting'. Внешний state.phase остаётся 'association'.
 */
export function castVote(state: ImaginariumState, voterId: string, slot: number): ImaginariumState {
  if (state.phase === 'finished') {
    throw new ImaginariumError('GAME_FINISHED', 'Игра завершена');
  }
  if (state.phase !== 'association' || state.round == null || state.round.phase !== 'voting') {
    throw new ImaginariumError('WRONG_PHASE', 'Сейчас нельзя голосовать');
  }
  if (!state.players.includes(voterId)) {
    throw new ImaginariumError('NOT_PLAYER', 'Вы не участник игры');
  }
  if (voterId === state.round.leader) {
    throw new ImaginariumError('LEADER_CANNOT_VOTE', 'Ведущий не может голосовать');
  }
  if (state.round.votes[voterId] != null) {
    throw new ImaginariumError('ALREADY_VOTED', 'Вы уже проголосовали');
  }
  if (state.round.slots == null || slot < 0 || slot >= state.round.slots.length) {
    throw new ImaginariumError('INVALID_SLOT', 'Неверный номер слота');
  }
  if (state.round.slots[slot] === voterId) {
    throw new ImaginariumError('CANNOT_VOTE_OWN_CARD', 'Нельзя голосовать за свою карту');
  }

  const votes = { ...state.round.votes, [voterId]: slot };
  const entry: ImaginariumLogEntry = { type: 'vote', voterId, slot };

  return {
    ...state,
    round: {
      ...state.round,
      votes,
    },
    log: [...state.log, entry],
  };
}

/**
 * Подсчёт очков раунда (Dixit-скоринг). Вызывается менеджером по завершении
 * голосования (все не-ведущие проголосовали, либо таймаут с частичными
 * голосами). Вычисляет дельты очков, обновляет scores и переводит round.phase
 * из 'voting' в 'scoring'. Внешний state.phase остаётся 'association'.
 *
 * Правила подсчёта:
 * - Если все не-ведущие угадали карту ведущего, или никто не угадал
 *   (allOrNone): ведущий получает 0, каждый не-ведущий +2 (утешительные).
 * - Иначе: ведущий +3, каждый угадавший +3.
 * - В обоих случаях: +1 за каждый голос автору проголосованной карты
 *   (включая голоса за карту ведущего).
 */
export function tallyRound(state: ImaginariumState): ImaginariumState {
  if (state.phase === 'finished') {
    throw new ImaginariumError('GAME_FINISHED', 'Игра завершена');
  }
  if (state.phase !== 'association' || state.round == null || state.round.phase !== 'voting') {
    throw new ImaginariumError('WRONG_PHASE', 'Сейчас нельзя подсчитать раунд');
  }

  const round: ImaginariumRound = state.round;
  if (round.slots == null) {
    throw new ImaginariumError('WRONG_PHASE', 'Слоты стола не открыты');
  }

  const slots: string[] = round.slots;
  const votes = round.votes;
  const leader = round.leader;
  const voters = Object.keys(votes);
  const leaderSlot = slots.indexOf(leader);
  const votersForLeader = voters.filter((v) => votes[v] === leaderSlot);
  const allOrNone = votersForLeader.length === 0 || votersForLeader.length === voters.length;

  const deltas: Record<string, number> = {};
  for (const p of state.players) deltas[p] = 0;

  if (allOrNone) {
    // ведущий получает 0; каждый не-ведущий +2 (утешительные)
    for (const p of state.players) if (p !== leader) deltas[p] = (deltas[p] ?? 0) + 2;
  } else {
    // ведущий +3; каждый угадавший +3
    deltas[leader] = (deltas[leader] ?? 0) + 3;
    for (const v of votersForLeader) deltas[v] = (deltas[v] ?? 0) + 3;
  }

  // +1 за каждый голос автору проголосованной карты (в обоих случаях,
  // включая голоса за карту ведущего)
  for (const v of voters) {
    const author = slots[votes[v]!]!;
    deltas[author] = (deltas[author] ?? 0) + 1;
  }

  const newScores: Record<string, number> = {};
  for (const p of state.players) newScores[p] = (state.scores[p] ?? 0) + (deltas[p] ?? 0);

  const entry: ImaginariumLogEntry = { type: 'scored', round: state.roundNumber, deltas };

  return {
    ...state,
    scores: newScores,
    round: { ...round, phase: 'scoring' },
    log: [...state.log, entry],
  };
}

/**
 * Завершает игру: вычисляет победителей (игроки с максимальным счётом),
 * выставляет phase 'finished', обнуляет раунд, пишет в лог 'gameover'.
 * players, scores, hands, deck, handSize, leaderIndex, roundNumber не меняются.
 */
export function finishGame(state: ImaginariumState): ImaginariumState {
  if (state.phase === 'finished') {
    throw new ImaginariumError('GAME_FINISHED', 'Игра уже завершена');
  }

  const max = Math.max(...state.players.map((p) => state.scores[p]!));
  const winner = state.players.filter((p) => state.scores[p] === max);
  const entry: ImaginariumLogEntry = { type: 'gameover', winners: winner };

  return {
    ...state,
    phase: 'finished',
    winner,
    round: null,
    log: [...state.log, entry],
  };
}

/**
 * Добор карт после подсчёта раунда (round.phase 'scoring'): раздаёт по 1 карте
 * каждому игроку из начала колоды. Если колоды не хватает на всех — игра
 * завершается через finishGame (частичный добор не делается).
 * Без лога: 'round-start' добавит advanceLeader. round остаётся 'scoring'.
 */
export function refillHands(state: ImaginariumState): ImaginariumState {
  if (state.phase === 'finished') {
    throw new ImaginariumError('GAME_FINISHED', 'Игра завершена');
  }
  if (state.phase !== 'association' || state.round == null || state.round.phase !== 'scoring') {
    throw new ImaginariumError('WRONG_PHASE', 'Сейчас нельзя добирать карты');
  }

  if (state.deck.length < state.players.length) {
    return finishGame(state);
  }

  const hands: Record<string, CardId[]> = {};
  state.players.forEach((p, i) => {
    hands[p] = [...state.hands[p]!, state.deck[i]!];
  });

  return {
    ...state,
    hands,
    deck: state.deck.slice(state.players.length),
  };
}

/**
 * Начинает следующий раунд: циклически сдвигает leaderIndex, создаёт свежий
 * round в 'association', увеличивает roundNumber, пишет в лог 'round-start'.
 * Внешний state.phase остаётся 'association'. Вызывается менеджером только если
 * refillHands не завершил игру.
 */
export function advanceLeader(state: ImaginariumState): ImaginariumState {
  if (state.phase === 'finished') {
    throw new ImaginariumError('GAME_FINISHED', 'Игра завершена');
  }
  if (state.phase !== 'association' || state.round == null || state.round.phase !== 'scoring') {
    throw new ImaginariumError('WRONG_PHASE', 'Сейчас нельзя начать следующий раунд');
  }

  const newLeaderIndex = (state.leaderIndex + 1) % state.players.length;
  const newRoundNumber = state.roundNumber + 1;
  const leader = state.players[newLeaderIndex]!;
  const entry: ImaginariumLogEntry = { type: 'round-start', leader, roundNumber: newRoundNumber };

  return {
    ...state,
    leaderIndex: newLeaderIndex,
    roundNumber: newRoundNumber,
    round: {
      leader,
      association: null,
      submissions: {},
      slots: null,
      votes: {},
      phase: 'association',
    },
    log: [...state.log, entry],
  };
}
