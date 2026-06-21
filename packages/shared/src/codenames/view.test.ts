import { describe, expect, test } from 'bun:test';
import { CODENAMES_WORDS_RU, pickWords } from './dictionary';
import { BOARD_SIZE, createGame, giveClue, guess } from './engine';
import { redactCodenames } from './view';
import type { CodenamesState } from './types';

const seeded = (seed = 42) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

const newGame = (seed = 42): CodenamesState =>
  createGame(pickWords(BOARD_SIZE, seeded(seed)), { startingTeam: 'red', random: seeded(seed) });

const findCard = (state: CodenamesState, owner: string) =>
  state.cards.findIndex((c) => c.owner === owner && !c.revealed);

describe('redactCodenames', () => {
  test('seesKey=false: owner скрыт до открытия, открытые карты видны', () => {
    const s = newGame();
    const v = redactCodenames(s, false);
    // ни одна карта не открыта → все owner null (ключ не утекает отгадывающему)
    expect(v.cards.every((c) => c.owner === null)).toBe(true);
    expect(v.cards.every((c) => c.revealed === false)).toBe(true);
    // слова при этом видны
    expect(v.cards.every((c) => c.word.length > 0)).toBe(true);

    // капитан даёт подсказку, команда открывает свою карту
    const s2 = giveClue(s, { word: 'фываж', count: 1 });
    const idx = findCard(s2, 'red');
    const s3 = guess(s2, idx);
    const v3 = redactCodenames(s3, false);
    const opened = v3.cards[idx]!;
    expect(opened.owner).toBe('red');
    expect(opened.revealed).toBe(true);
    // остальные всё ещё скрыты
    const others = v3.cards.filter((_, i) => i !== idx);
    expect(others.every((c) => c.owner === null)).toBe(true);
  });

  test('seesKey=true (капитан): видны все owner, даже неоткрытые', () => {
    const s = newGame();
    const v = redactCodenames(s, true);
    // ключ-карта целиком видна капитану
    expect(v.cards.every((c) => c.owner !== null)).toBe(true);
    // но сами карты ещё не открыты (revealed = факт открытия на столе)
    expect(v.cards.every((c) => c.revealed === false)).toBe(true);
    // состав владельцев соответствует правилам 9/8/7/1
    const owners = v.cards.map((c) => c.owner);
    expect(owners.filter((o) => o === 'red').length).toBe(9);
    expect(owners.filter((o) => o === 'blue').length).toBe(8);
    expect(owners.filter((o) => o === 'neutral').length).toBe(7);
    expect(owners.filter((o) => o === 'assassin').length).toBe(1);
  });

  test("guessesLeft: null → 'unlimited', число — как есть (JSON-сейф)", () => {
    const s = newGame();
    const withCount = giveClue(s, { word: 'фываж', count: 2 });
    expect(redactCodenames(withCount, false).guessesLeft).toBe(3); // count + 1
    const unlimited = giveClue(s, { word: 'фываж', count: 0 });
    expect(unlimited.guessesLeft).toBeNull(); // null вместо Infinity
    expect(redactCodenames(unlimited, false).guessesLeft).toBe('unlimited');
  });

  test('guessesLeft JSON round-trip: null остаётся null, число — числом', () => {
    const s = newGame();
    const unlimited = giveClue(s, { word: 'фываж', count: 0 });
    const roundtripped = JSON.parse(JSON.stringify(unlimited)) as CodenamesState;
    expect(roundtripped.guessesLeft).toBeNull(); // не стал undefined/null-от-Infinity

    const withCount = giveClue(s, { word: 'фываж', count: 3 });
    const rt2 = JSON.parse(JSON.stringify(withCount)) as CodenamesState;
    expect(rt2.guessesLeft).toBe(4); // число прошло round-trip как число
  });

  test('remaining: счёт по командам из неоткрытых слов', () => {
    const s = newGame();
    expect(redactCodenames(s, false).remaining).toEqual({ red: 9, blue: 8 });
  });

  test('log ограничен slice(-MAX_LOG) — не растёт без лимита (аудит §10)', () => {
    const s = newGame();
    // нагнетаем 100 записей в лог (длинная серия без rematch)
    for (let i = 0; i < 100; i++) s.log.push({ type: 'pass', team: 'red' });
    expect(redactCodenames(s, false).log.length).toBe(60);
    // последние 60 — те, что в хвосте
    expect(redactCodenames(s, false).log[0]).toEqual({ type: 'pass', team: 'red' });
  });
});

describe('redactCodenames · словарь', () => {
  test('есть минимум BOARD_SIZE слов', () => {
    expect(CODENAMES_WORDS_RU.length).toBeGreaterThanOrEqual(BOARD_SIZE);
  });
});
