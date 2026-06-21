import { describe, expect, test } from 'bun:test';
import { DEFAULT_HAND_SIZE, ImaginariumError } from './types';
import type { ImaginariumErrorCode } from './types';
import { createImaginariumGame } from './engine';

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
