import { describe, expect, test } from 'bun:test';
import { DEFAULT_HAND_SIZE, ImaginariumError } from './types';
import type { ImaginariumErrorCode, ImaginariumState } from './types';
import { createImaginariumGame, submitCard, submitLeader } from './engine';

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
