import { describe, expect, test } from 'bun:test';
import { CODENAMES_WORDS_RU, pickWords } from './dictionary';
import { BOARD_SIZE, createGame, giveClue, guess, otherTeam, pass, score } from './engine';
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

describe('createGame', () => {
  test('раскладка 9/8/7/1, стартовая команда ходит первой', () => {
    const g = newGame();
    const count = (o: string) => g.cards.filter((c) => c.owner === o).length;
    expect(g.cards.length).toBe(25);
    expect(count('red')).toBe(9);
    expect(count('blue')).toBe(8);
    expect(count('neutral')).toBe(7);
    expect(count('assassin')).toBe(1);
    expect(g.turn).toBe('red');
    expect(g.phase).toBe('clue');
  });

  test('слова на поле уникальны', () => {
    const g = newGame(7);
    expect(new Set(g.cards.map((c) => c.word)).size).toBe(25);
  });

  test('мало слов — ошибка', () => {
    expect(() => createGame(['кот', 'пес'])).toThrow();
  });
});

describe('giveClue', () => {
  test('переводит в фазу отгадывания, попыток = число + 1', () => {
    const g = giveClue(newGame(), { word: 'фываж', count: 2 });
    expect(g.phase).toBe('guess');
    expect(g.guessesLeft).toBe(3);
  });

  test('нельзя слово с поля или однокоренное', () => {
    const g = newGame();
    const word = g.cards[0]!.word;
    expect(() => giveClue(g, { word, count: 1 })).toThrow('похожа');
  });

  test('число вне 0–9 или два слова — ошибка', () => {
    const g = newGame();
    expect(() => giveClue(g, { word: 'фываж', count: 10 })).toThrow();
    expect(() => giveClue(g, { word: 'два слова', count: 1 })).toThrow();
  });

  test('count 0 — неограниченные попытки', () => {
    const g = giveClue(newGame(), { word: 'фываж', count: 0 });
    expect(g.guessesLeft).toBeNull();
  });
});

describe('guess', () => {
  const started = () => giveClue(newGame(), { word: 'фываж', count: 2 });

  test('своё слово — продолжаем, попытки уменьшаются', () => {
    let g = started();
    g = guess(g, findCard(g, 'red'));
    expect(g.phase).toBe('guess');
    expect(g.turn).toBe('red');
    expect(g.guessesLeft).toBe(2);
  });

  test('нейтральное — ход переходит', () => {
    let g = started();
    g = guess(g, findCard(g, 'neutral'));
    expect(g.turn).toBe('blue');
    expect(g.phase).toBe('clue');
  });

  test('чужое — ход переходит', () => {
    let g = started();
    g = guess(g, findCard(g, 'blue'));
    expect(g.turn).toBe('blue');
    expect(g.phase).toBe('clue');
  });

  test('убийца — мгновенное поражение', () => {
    let g = started();
    g = guess(g, findCard(g, 'assassin'));
    expect(g.phase).toBe('finished');
    expect(g.winner).toBe('blue');
    expect(g.winReason).toBe('assassin');
  });

  test('исчерпали попытки — ход переходит', () => {
    let g = started();
    g = guess(g, findCard(g, 'red'));
    g = guess(g, findCard(g, 'red'));
    g = guess(g, findCard(g, 'red'));
    expect(g.turn).toBe('blue');
    expect(g.phase).toBe('clue');
  });

  test('открыли все свои слова — победа', () => {
    let g = newGame();
    for (let i = 0; i < 9; i++) {
      if (g.phase === 'clue') g = giveClue(g, { word: 'фываж', count: 0 });
      g = guess(g, findCard(g, 'red'));
    }
    expect(g.phase).toBe('finished');
    expect(g.winner).toBe('red');
    expect(g.winReason).toBe('all-words');
  });

  test('открыли последнее чужое слово — победа соперника', () => {
    let g = newGame();
    // красные «случайно» открывают все 8 синих слов
    for (let i = 0; i < 8; i++) {
      if (g.phase === 'clue') {
        g = { ...g, turn: 'red' };
        g = giveClue(g, { word: 'фываж', count: 0 });
      }
      g = guess(g, findCard(g, 'blue'));
    }
    expect(g.winner).toBe('blue');
  });

  test('нельзя открыть уже открытую или несуществующую', () => {
    let g = started();
    const i = findCard(g, 'red');
    g = guess(g, i);
    expect(() => guess(g, i)).toThrow();
    expect(() => guess(g, 99)).toThrow();
  });

  test('нельзя отгадывать без подсказки', () => {
    expect(() => guess(newGame(), 0)).toThrow();
  });
});

describe('pass / score / log', () => {
  test('пас передаёт ход', () => {
    let g = giveClue(newGame(), { word: 'фываж', count: 2 });
    g = pass(g);
    expect(g.turn).toBe('blue');
    expect(g.phase).toBe('clue');
  });

  test('score считает оставшиеся слова', () => {
    let g = giveClue(newGame(), { word: 'фываж', count: 2 });
    expect(score(g)).toEqual({ red: 9, blue: 8 });
    g = guess(g, findCard(g, 'red'));
    expect(score(g).red).toBe(8);
  });

  test('лог пишет подсказки, ходы и финал', () => {
    let g = giveClue(newGame(), { word: 'фываж', count: 1 });
    g = guess(g, findCard(g, 'assassin'));
    const types = g.log.map((e) => e.type);
    expect(types).toEqual(['clue', 'guess', 'gameover']);
  });

  test('после конца игры все действия запрещены', () => {
    let g = giveClue(newGame(), { word: 'фываж', count: 1 });
    g = guess(g, findCard(g, 'assassin'));
    expect(() => giveClue(g, { word: 'другое', count: 1 })).toThrow();
    expect(() => guess(g, 0)).toThrow();
    expect(() => pass(g)).toThrow();
  });

  test('otherTeam', () => {
    expect(otherTeam('red')).toBe('blue');
    expect(otherTeam('blue')).toBe('red');
  });
});

describe('словарь', () => {
  test('минимум 400 слов, без дублей', () => {
    expect(CODENAMES_WORDS_RU.length).toBeGreaterThanOrEqual(400);
    expect(new Set(CODENAMES_WORDS_RU).size).toBe(CODENAMES_WORDS_RU.length);
  });

  test('pickWords: нужное количество, без повторов, из словаря', () => {
    const words = pickWords(25, seeded(1));
    expect(words.length).toBe(25);
    expect(new Set(words).size).toBe(25);
    for (const w of words) expect(CODENAMES_WORDS_RU).toContain(w);
  });

  test('pickWords: больше словаря — ошибка', () => {
    expect(() => pickWords(100000)).toThrow();
  });
});
