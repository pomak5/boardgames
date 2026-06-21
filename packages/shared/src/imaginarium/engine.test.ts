import { describe, expect, test } from 'bun:test';
import { DEFAULT_HAND_SIZE, ImaginariumError } from './types';
import type { ImaginariumErrorCode, ImaginariumState } from './types';
import {
  advanceLeader,
  castVote,
  createImaginariumGame,
  finishImaginariumGame,
  refillHands,
  revealTable,
  submitCard,
  submitLeader,
  tallyRound,
} from './engine';

/** Удобный хелпер: вызывает fn и проверяет, что бросает ImaginariumError с нужным code. */
function expectErrorCode(fn: () => unknown, code: ImaginariumErrorCode): void {
  try {
    fn();
    throw new Error('ожидалась ошибка, но функция завершилась без исключения');
  } catch (e) {
    expect(e).toBeInstanceOf(ImaginariumError);
    expect((e as ImaginariumError).code).toBe(code);
  }
}

const seeded = (seed = 42) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

const deck = (n: number) =>
  Array.from({ length: n }, (_, i) => `card-${String(i + 1).padStart(3, '0')}`);

describe('createImaginariumGame', () => {
  test('валидная раздача (4 игрока, колода 84, рука 6)', () => {
    const players = ['a', 'b', 'c', 'd'];
    const state = createImaginariumGame({
      playerIds: players,
      deck: deck(84),
      handSize: 6,
      random: seeded(1),
    });

    expect(state.players).toEqual(players);
    expect(Object.keys(state.hands)).toHaveLength(4);
    for (const p of players) {
      expect(state.hands[p]).toHaveLength(6);
    }
    expect(state.deck).toHaveLength(84 - 24);
    expect(state.leaderIndex).toBe(0);
    expect(state.round!.leader).toBe(players[0]!);
    expect(state.round!.phase).toBe('association');
    expect(state.round!.association).toBeNull();
    expect(state.round!.submissions).toEqual({});
    expect(state.round!.slots).toBeNull();
    expect(state.round!.votes).toEqual({});
    expect(state.phase).toBe('association');
    expect(state.roundNumber).toBe(1);
    for (const p of players) expect(state.scores[p]).toBe(0);
    expect(state.winner).toBeNull();
    expect(state.log[0]).toEqual({
      type: 'round-start',
      leader: players[0]!,
      roundNumber: 1,
    });
  });

  test('слишком мало игроков (<3) → INVALID_PLAYERS', () => {
    expectErrorCode(
      () => createImaginariumGame({ playerIds: ['a', 'b'], deck: deck(84), random: seeded() }),
      'INVALID_PLAYERS',
    );
  });

  test('слишком много игроков (>6) → INVALID_PLAYERS', () => {
    expectErrorCode(
      () =>
        createImaginariumGame({
          playerIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
          deck: deck(84),
          random: seeded(),
        }),
      'INVALID_PLAYERS',
    );
  });

  test('дубликаты playerIds → INVALID_PLAYERS', () => {
    expectErrorCode(
      () => createImaginariumGame({ playerIds: ['a', 'b', 'a'], deck: deck(84), random: seeded() }),
      'INVALID_PLAYERS',
    );
  });

  test('колода слишком мала → DECK_TOO_SMALL', () => {
    expectErrorCode(
      () =>
        createImaginariumGame({
          playerIds: ['a', 'b', 'c', 'd'],
          deck: deck(23),
          handSize: 6,
          random: seeded(),
        }),
      'DECK_TOO_SMALL',
    );
  });

  test('детерминизм: одинаковый seed → одинаковая раздача; разный seed → разная', () => {
    const players = ['a', 'b', 'c', 'd'];
    const d = deck(84);
    const s1a = createImaginariumGame({ playerIds: players, deck: d, random: seeded(1) });
    const s1b = createImaginariumGame({ playerIds: players, deck: d, random: seeded(1) });
    const s2 = createImaginariumGame({ playerIds: players, deck: d, random: seeded(2) });

    expect(s1a.hands).toEqual(s1b.hands);
    expect(s1a.deck).toEqual(s1b.deck);

    // разные seed → разная раздача (проверяем, что не совпадает полностью)
    const sameHands = JSON.stringify(s1a.hands) === JSON.stringify(s2.hands);
    const sameDeck = JSON.stringify(s1a.deck) === JSON.stringify(s2.deck);
    expect(sameHands && sameDeck).toBe(false);
  });

  test('входная колода не мутируется', () => {
    const d = deck(84);
    const dCopy = [...d];
    createImaginariumGame({
      playerIds: ['a', 'b', 'c', 'd'],
      deck: d,
      handSize: 6,
      random: seeded(1),
    });
    expect(d).toEqual(dCopy);
    expect(d).toHaveLength(84);
  });

  test('handSize по умолчанию = 6', () => {
    const players = ['a', 'b', 'c'];
    const state = createImaginariumGame({
      playerIds: players,
      deck: deck(84),
      random: seeded(1),
    });
    for (const p of players) {
      expect(state.hands[p]).toHaveLength(DEFAULT_HAND_SIZE);
    }
  });

  test('граничная колода: deck.length === handSize*players → успешно, deck пуст', () => {
    const players = ['a', 'b', 'c', 'd'];
    const state = createImaginariumGame({
      playerIds: players,
      deck: deck(24),
      handSize: 6,
      random: seeded(1),
    });
    for (const p of players) expect(state.hands[p]).toHaveLength(6);
    expect(state.deck).toEqual([]);
  });

  test('сохранность множества карт: ничего не теряется и не дублируется', () => {
    const players = ['a', 'b', 'c', 'd'];
    const d = deck(84);
    const state = createImaginariumGame({
      playerIds: players,
      deck: d,
      handSize: 6,
      random: seeded(7),
    });
    const dealt = [...players.flatMap((p) => state.hands[p]!), ...state.deck];
    expect(dealt).toHaveLength(84);
    expect(new Set(dealt)).toEqual(new Set(d));
  });
});

// --- Хелперы для submitLeader / submitCard ---

const newGame = (seed = 42): ImaginariumState =>
  createImaginariumGame({
    playerIds: ['a', 'b', 'c', 'd'],
    deck: deck(84),
    handSize: 6,
    random: seeded(seed),
  });

const finished = (): ImaginariumState => ({
  ...newGame(),
  phase: 'finished',
  round: null,
  winner: ['a'],
});

describe('submitLeader', () => {
  test('валидная подача → round.phase=choosing, карта убрана, ассоциация записана, лог', () => {
    const g = newGame();
    const leader = 'a';
    const cardId = g.hands[leader]![0]!;
    const before = g;
    const assoc = 'загадочное настроение';
    const next = submitLeader(g, leader, cardId, assoc);

    expect(next.round!.phase).toBe('choosing');
    expect(next.round!.submissions[leader]).toBe(cardId);
    expect(next.round!.association).toBe(assoc);
    expect(next.hands[leader]).toHaveLength(5);
    expect(next.hands[leader]!.includes(cardId)).toBe(false);
    expect(next.phase).toBe('association');
    expect(next.log[next.log.length - 1]).toEqual({
      type: 'association',
      leader,
      association: assoc,
    });
    // входное состояние не мутируется
    expect(before.round!.phase).toBe('association');
    expect(before.hands[leader]!.includes(cardId)).toBe(true);
  });

  test('не ведущий → NOT_LEADER', () => {
    const g = newGame();
    const cardId = g.hands['b']![0]!;
    expectErrorCode(() => submitLeader(g, 'b', cardId, 'ассоциация'), 'NOT_LEADER');
  });

  test('пустая ассоциация "" → EMPTY_ASSOCIATION; пробелы "   " → EMPTY_ASSOCIATION', () => {
    const g = newGame();
    const cardId = g.hands['a']![0]!;
    expectErrorCode(() => submitLeader(g, 'a', cardId, ''), 'EMPTY_ASSOCIATION');
    expectErrorCode(() => submitLeader(g, 'a', cardId, '   '), 'EMPTY_ASSOCIATION');
  });

  test('карта не в руке ведущего → CARD_NOT_IN_HAND', () => {
    const g = newGame();
    expectErrorCode(() => submitLeader(g, 'a', 'nope', 'ассоциация'), 'CARD_NOT_IN_HAND');
  });

  test('неправильная фаза (повторный вызов в choosing) → WRONG_PHASE', () => {
    const g = newGame();
    const cardId = g.hands['a']![0]!;
    const next = submitLeader(g, 'a', cardId, 'ассоциация');
    const secondCard = next.hands['a']![0]!;
    expectErrorCode(() => submitLeader(next, 'a', secondCard, 'ещё'), 'WRONG_PHASE');
  });

  test('игра завершена → GAME_FINISHED', () => {
    expectErrorCode(() => submitLeader(finished(), 'a', 'card-001', 'ассоциация'), 'GAME_FINISHED');
  });
});

describe('submitCard', () => {
  test('валидная подача → карта в submissions, убрана из руки, лог submitted, round.phase=choosing', () => {
    const leaderCard = newGame().hands['a']![0]!;
    const choosing = submitLeader(newGame(), 'a', leaderCard, 'ассоциация');
    const player = 'b';
    const cardId = choosing.hands[player]![0]!;
    const before = choosing;
    const next = submitCard(choosing, player, cardId);

    expect(next.round!.submissions[player]).toBe(cardId);
    expect(next.hands[player]).toHaveLength(5);
    expect(next.hands[player]!.includes(cardId)).toBe(false);
    expect(next.round!.phase).toBe('choosing');
    expect(next.log[next.log.length - 1]).toEqual({ type: 'submitted', playerId: player });
    // входное состояние не мутируется
    expect(before.round!.submissions[player]).toBeUndefined();
    expect(before.hands[player]!.includes(cardId)).toBe(true);
  });

  test('ведущий вызывает submitCard → ALREADY_SUBMITTED', () => {
    const leaderCard = newGame().hands['a']![0]!;
    const choosing = submitLeader(newGame(), 'a', leaderCard, 'ассоциация');
    const otherCard = choosing.hands['a']![0]!;
    expectErrorCode(() => submitCard(choosing, 'a', otherCard), 'ALREADY_SUBMITTED');
  });

  test('тот же игрок дважды → ALREADY_SUBMITTED', () => {
    const leaderCard = newGame().hands['a']![0]!;
    const choosing = submitLeader(newGame(), 'a', leaderCard, 'ассоциация');
    const player = 'b';
    const card1 = choosing.hands[player]![0]!;
    const after = submitCard(choosing, player, card1);
    const card2 = after.hands[player]![0]!;
    expectErrorCode(() => submitCard(after, player, card2), 'ALREADY_SUBMITTED');
  });

  test('карта не в руке → CARD_NOT_IN_HAND', () => {
    const leaderCard = newGame().hands['a']![0]!;
    const choosing = submitLeader(newGame(), 'a', leaderCard, 'ассоциация');
    expectErrorCode(() => submitCard(choosing, 'b', 'nope'), 'CARD_NOT_IN_HAND');
  });

  test('не игрок → NOT_PLAYER', () => {
    const leaderCard = newGame().hands['a']![0]!;
    const choosing = submitLeader(newGame(), 'a', leaderCard, 'ассоциация');
    expectErrorCode(() => submitCard(choosing, 'z', 'card-001'), 'NOT_PLAYER');
  });

  test('неправильная фаза (до submitLeader) → WRONG_PHASE', () => {
    const g = newGame();
    const cardId = g.hands['b']![0]!;
    expectErrorCode(() => submitCard(g, 'b', cardId), 'WRONG_PHASE');
  });

  test('игра завершена → GAME_FINISHED', () => {
    expectErrorCode(() => submitCard(finished(), 'b', 'card-001'), 'GAME_FINISHED');
  });
});

// --- Хелперы для revealTable / castVote ---

/** Игра в round.phase 'choosing' (ведущий уже подал). */
const inChoosing = (seed = 42): ImaginariumState => {
  const g = newGame(seed);
  return submitLeader(g, 'a', g.hands['a']![0]!, 'ассоциация');
};

/** Игра в round.phase 'choosing' со всеми 4 подачами (стол ещё не открыт). */
const inChoosingFull = (seed = 42): ImaginariumState => {
  let g = inChoosing(seed);
  for (const p of ['b', 'c', 'd']) g = submitCard(g, p, g.hands[p]![0]!);
  return g;
};

/** Игра в round.phase 'voting' (все 4 игрока подали, стол перемешан). */
const inVoting = (seed = 42): ImaginariumState => revealTable(inChoosingFull(seed), seeded(seed));

describe('revealTable', () => {
  test('валид (все 4 подали) → slots — перестановка игроков, phase=voting, лог reveal, outer association', () => {
    const state = revealTable(inChoosingFull(42), seeded(42));
    expect(state.round!.slots).toHaveLength(4);
    expect(new Set(state.round!.slots!)).toEqual(new Set(['a', 'b', 'c', 'd']));
    expect(state.round!.phase).toBe('voting');
    expect(state.phase).toBe('association');
    expect(state.log[state.log.length - 1]).toEqual({
      type: 'reveal',
      slots: state.round!.slots!,
    });
  });

  test('частичные подачи (таймаут) → 2 слота, phase=voting, не бросает', () => {
    let g = inChoosing(7);
    g = submitCard(g, 'b', g.hands['b']![0]!);
    const state = revealTable(g, seeded(7));
    expect(state.round!.slots).toHaveLength(2);
    expect(new Set(state.round!.slots!)).toEqual(new Set(['a', 'b']));
    expect(state.round!.phase).toBe('voting');
  });

  test('неправильная фаза (до submitLeader, round.phase=association) → WRONG_PHASE', () => {
    expectErrorCode(() => revealTable(newGame(), seeded()), 'WRONG_PHASE');
  });

  test('игра завершена → GAME_FINISHED', () => {
    expectErrorCode(() => revealTable(finished(), seeded()), 'GAME_FINISHED');
  });

  test('детерминизм: одинаковый seed → одинаковый порядок; разный seed → разный', () => {
    const a = revealTable(inChoosingFull(1), seeded(1));
    const b = revealTable(inChoosingFull(1), seeded(1));
    expect(a.round!.slots).toEqual(b.round!.slots);
    const c = revealTable(inChoosingFull(1), seeded(99));
    expect(JSON.stringify(a.round!.slots) === JSON.stringify(c.round!.slots)).toBe(false);
  });

  test('входное состояние не мутируется', () => {
    const g = inChoosingFull(3);
    const subsBefore = { ...g.round!.submissions };
    const handsBefore = JSON.parse(JSON.stringify(g.hands));
    const logBefore = g.log.length;
    revealTable(g, seeded(3));
    expect(g.round!.submissions).toEqual(subsBefore);
    expect(g.hands).toEqual(handsBefore);
    expect(g.log).toHaveLength(logBefore);
    expect(g.round!.phase).toBe('choosing');
    expect(g.round!.slots).toBeNull();
  });
});

describe('castVote', () => {
  test('валид: не-ведущий голосует за чужой слот → голос записан, лог vote, phase=voting', () => {
    const state = inVoting(42);
    const voter = 'b';
    const own = state.round!.slots!.indexOf(voter);
    const slot = state.round!.slots!.findIndex((p, i) => i !== own);
    const next = castVote(state, voter, slot);
    expect(next.round!.votes[voter]).toBe(slot);
    expect(next.log[next.log.length - 1]).toEqual({ type: 'vote', voterId: voter, slot });
    expect(next.round!.phase).toBe('voting');
  });

  test('ведущий голосует → LEADER_CANNOT_VOTE', () => {
    const state = inVoting(42);
    expectErrorCode(() => castVote(state, 'a', 0), 'LEADER_CANNOT_VOTE');
  });

  test('тот же не-ведущий дважды → ALREADY_VOTED', () => {
    const state = inVoting(42);
    const voter = 'b';
    const own = state.round!.slots!.indexOf(voter);
    const slot = state.round!.slots!.findIndex((p, i) => i !== own);
    const after = castVote(state, voter, slot);
    const own2 = after.round!.slots!.indexOf(voter);
    const slot2 = after.round!.slots!.findIndex((p, i) => i !== own2);
    expectErrorCode(() => castVote(after, voter, slot2), 'ALREADY_VOTED');
  });

  test('невалидный слот: -1 → INVALID_SLOT; slots.length → INVALID_SLOT', () => {
    const state = inVoting(42);
    expectErrorCode(() => castVote(state, 'b', -1), 'INVALID_SLOT');
    expectErrorCode(() => castVote(state, 'b', state.round!.slots!.length), 'INVALID_SLOT');
  });

  test('голос за свой собственный слот → CANNOT_VOTE_OWN_CARD', () => {
    const state = inVoting(42);
    const voter = 'b';
    const own = state.round!.slots!.indexOf(voter);
    expectErrorCode(() => castVote(state, voter, own), 'CANNOT_VOTE_OWN_CARD');
  });

  test('не игрок → NOT_PLAYER', () => {
    const state = inVoting(42);
    expectErrorCode(() => castVote(state, 'z', 0), 'NOT_PLAYER');
  });

  test('неправильная фаза (round.phase=choosing) → WRONG_PHASE', () => {
    const state = inChoosing(42);
    expectErrorCode(() => castVote(state, 'b', 0), 'WRONG_PHASE');
  });

  test('игра завершена → GAME_FINISHED', () => {
    expectErrorCode(() => castVote(finished(), 'b', 0), 'GAME_FINISHED');
  });

  test('входное состояние не мутируется', () => {
    const state = inVoting(5);
    const voter = 'b';
    const own = state.round!.slots!.indexOf(voter);
    const slot = state.round!.slots!.findIndex((p, i) => i !== own);
    const votesBefore = { ...state.round!.votes };
    const logBefore = state.log.length;
    castVote(state, voter, slot);
    expect(state.round!.votes).toEqual(votesBefore);
    expect(state.log).toHaveLength(logBefore);
  });
});

describe('tallyRound', () => {
  /** Строит состояние голосования и прогоняет указанные голоса.
   *  votesToCast: Record<voterId, targetPlayerId> — голосует за слот, где лежит
   *  карта targetPlayerId. Проверяет, что voter ≠ target (castVote это валидирует). */
  const votingWithVotes = (seed: number, votesToCast: Record<string, string>): ImaginariumState => {
    let s = inVoting(seed);
    for (const [voter, target] of Object.entries(votesToCast)) {
      const slot = s.round!.slots!.indexOf(target);
      s = castVote(s, voter, slot);
    }
    return s;
  };

  test('частичный: b,c угадали ведущего, d голосует за b → дельты 5/4/3/0', () => {
    const state = votingWithVotes(42, { b: 'a', c: 'a', d: 'b' });
    const initial = { ...state.scores };
    const next = tallyRound(state);
    expect(next.scores['a']).toBe(initial['a']! + 5);
    expect(next.scores['b']).toBe(initial['b']! + 4);
    expect(next.scores['c']).toBe(initial['c']! + 3);
    expect(next.scores['d']).toBe(initial['d']! + 0);
  });

  test('все угадали: b,c,d → leaderSlot → allOrNone, дельты 3/2/2/2', () => {
    const state = votingWithVotes(42, { b: 'a', c: 'a', d: 'a' });
    const initial = { ...state.scores };
    const next = tallyRound(state);
    expect(next.scores['a']).toBe(initial['a']! + 3);
    expect(next.scores['b']).toBe(initial['b']! + 2);
    expect(next.scores['c']).toBe(initial['c']! + 2);
    expect(next.scores['d']).toBe(initial['d']! + 2);
  });

  test('никто не угадал: b→c, c→d, d→b → allOrNone, дельты 0/3/3/3', () => {
    const state = votingWithVotes(42, { b: 'c', c: 'd', d: 'b' });
    const initial = { ...state.scores };
    const next = tallyRound(state);
    expect(next.scores['a']).toBe(initial['a']! + 0);
    expect(next.scores['b']).toBe(initial['b']! + 3);
    expect(next.scores['c']).toBe(initial['c']! + 3);
    expect(next.scores['d']).toBe(initial['d']! + 3);
  });

  test('переходы: round.phase→scoring, outer phase→association, лог scored', () => {
    const state = votingWithVotes(11, { b: 'a', c: 'a', d: 'b' });
    const expectedDeltas: Record<string, number> = { a: 5, b: 4, c: 3, d: 0 };
    const next = tallyRound(state);
    expect(next.round!.phase).toBe('scoring');
    expect(next.phase).toBe('association');
    expect(next.log[next.log.length - 1]).toEqual({
      type: 'scored',
      round: state.roundNumber,
      deltas: expectedDeltas,
    });
  });

  test('иммутабельность: входное состояние не мутируется', () => {
    const state = votingWithVotes(33, { b: 'a', c: 'a', d: 'b' });
    const scoresBefore = { ...state.scores };
    const votesBefore = { ...state.round!.votes };
    const phaseBefore = state.round!.phase;
    const logBefore = state.log.length;
    tallyRound(state);
    expect(state.scores).toEqual(scoresBefore);
    expect(state.round!.votes).toEqual(votesBefore);
    expect(state.round!.phase).toBe(phaseBefore);
    expect(state.log).toHaveLength(logBefore);
  });

  test('неправильная фаза (round.phase=choosing) → WRONG_PHASE', () => {
    expectErrorCode(() => tallyRound(inChoosing(42)), 'WRONG_PHASE');
  });

  test('игра завершена → GAME_FINISHED', () => {
    expectErrorCode(() => tallyRound(finished()), 'GAME_FINISHED');
  });
});

// --- Хелперы для refillHands / advanceLeader / finishImaginariumGame ---

/** Состояние в round.phase 'scoring' (после tallyRound) — финальная фаза раунда.
 *  Меняем только то, что нужно тестам (round.phase, deck, scores, players, leaderIndex). */
const inScoring = (overrides?: Partial<ImaginariumState>): ImaginariumState => {
  const base = newGame();
  return {
    ...base,
    round: { ...base.round!, phase: 'scoring' },
    ...overrides,
  };
};

describe('finishImaginariumGame', () => {
  test('один победитель → phase=finished, winner, round=null, лог gameover', () => {
    const state = inScoring({ scores: { a: 5, b: 3, c: 3, d: 0 } });
    const next = finishImaginariumGame(state);
    expect(next.phase).toBe('finished');
    expect(next.winner).toEqual(['a']);
    expect(next.round).toBeNull();
    expect(next.log[next.log.length - 1]).toEqual({ type: 'gameover', winners: ['a'] });
  });

  test('ничья → winner содержит всех с максимальным счётом в порядке players', () => {
    const state = inScoring({ scores: { a: 5, b: 5, c: 3, d: 0 } });
    const next = finishImaginariumGame(state);
    expect(next.winner).toEqual(['a', 'b']);
  });

  test('игра уже завершена → GAME_FINISHED', () => {
    expectErrorCode(() => finishImaginariumGame(finished()), 'GAME_FINISHED');
  });
});

describe('refillHands', () => {
  test('колоды достаточно: каждому +1 карта спереди, deck обрезан, round.phase=scoring', () => {
    const d = deck(10);
    const state = inScoring({ deck: d });
    const handLensBefore = state.players.map((p) => state.hands[p]!.length);
    const handsBefore = JSON.parse(JSON.stringify(state.hands)) as Record<string, string[]>;
    const deckBefore = [...state.deck];
    const next = refillHands(state);

    // каждый получил ровно 1 карту
    state.players.forEach((p, i) => {
      expect(next.hands[p]).toHaveLength(handLensBefore[i]! + 1);
      // конкретная карта = deck[i] (присваивается по индексу игрока)
      expect(next.hands[p]![next.hands[p]!.length - 1]).toBe(d[i]);
      // прежние карты сохранены
      expect(next.hands[p]!.slice(0, -1)).toEqual(handsBefore[p]!);
    });
    expect(next.deck).toEqual(d.slice(state.players.length));
    expect(next.deck).toHaveLength(6);
    expect(next.round!.phase).toBe('scoring');
    expect(next.phase).toBe('association');

    // иммутабельность: вход не мутируется
    expect(state.deck).toEqual(deckBefore);
    expect(state.hands).toEqual(handsBefore);
  });

  test('колоды недостаточно (deck<players) → finishImaginariumGame: phase=finished, winner=max, round=null', () => {
    const state = inScoring({ deck: deck(2), scores: { a: 5, b: 3, c: 3, d: 0 } });
    const next = refillHands(state);
    expect(next.phase).toBe('finished');
    expect(next.winner).toEqual(['a']);
    expect(next.round).toBeNull();
    expect(next.log[next.log.length - 1]).toEqual({ type: 'gameover', winners: ['a'] });
  });

  test('игра завершена → GAME_FINISHED', () => {
    expectErrorCode(() => refillHands(finished()), 'GAME_FINISHED');
  });

  test('неправильная фаза (round.phase=voting) → WRONG_PHASE', () => {
    const state = inScoring({ round: { ...newGame().round!, phase: 'voting' } });
    expectErrorCode(() => refillHands(state), 'WRONG_PHASE');
  });
});

describe('advanceLeader', () => {
  test('валид (index 0→1): leaderIndex=1, roundNumber+1, fresh round association, лог round-start', () => {
    const state = inScoring({ leaderIndex: 0 });
    const beforeLog = state.log.length;
    const beforeRoundNumber = state.roundNumber;
    const beforeLeaderIndex = state.leaderIndex;
    const next = advanceLeader(state);

    expect(next.leaderIndex).toBe(1);
    expect(next.roundNumber).toBe(beforeRoundNumber + 1);
    expect(next.round!.leader).toBe('b');
    expect(next.round!.phase).toBe('association');
    expect(next.round!.association).toBeNull();
    expect(next.round!.submissions).toEqual({});
    expect(next.round!.slots).toBeNull();
    expect(next.round!.votes).toEqual({});
    expect(next.phase).toBe('association');
    expect(next.log[next.log.length - 1]).toEqual({
      type: 'round-start',
      leader: 'b',
      roundNumber: beforeRoundNumber + 1,
    });
    expect(next.log).toHaveLength(beforeLog + 1);

    // иммутабельность
    expect(state.leaderIndex).toBe(beforeLeaderIndex);
    expect(state.roundNumber).toBe(beforeRoundNumber);
    expect(state.log).toHaveLength(beforeLog);
  });

  test('обратный переход (index 3→0 для 4 игроков): leaderIndex=0, round.leader=a', () => {
    const state = inScoring({ leaderIndex: 3 });
    const next = advanceLeader(state);
    expect(next.leaderIndex).toBe(0);
    expect(next.round!.leader).toBe('a');
  });

  test('игра завершена → GAME_FINISHED', () => {
    expectErrorCode(() => advanceLeader(finished()), 'GAME_FINISHED');
  });

  test('неправильная фаза (round.phase=voting) → WRONG_PHASE', () => {
    const state = inScoring({ round: { ...newGame().round!, phase: 'voting' } });
    expectErrorCode(() => advanceLeader(state), 'WRONG_PHASE');
  });
});
