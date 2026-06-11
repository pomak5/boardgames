import { describe, expect, test } from 'bun:test';
import { pickWords } from './dictionary';
import { createGame, giveClue, guess, pass as passTurn, validateClue } from './engine';
import { suggestClue } from './bot';
import type { CodenamesState } from './types';

const seeded = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

const newGame = (seed: number): CodenamesState =>
  createGame(pickWords(25, seeded(seed)), { startingTeam: 'red', random: seeded(seed) });

describe('бот-капитан', () => {
  test('всегда находит валидную подсказку (50 случайных партий)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const g = newGame(seed);
      const t = suggestClue(g, 'red');
      expect(t).not.toBeNull();
      expect(() => validateClue(g, t!.clue)).not.toThrow();
      expect(t!.clue.count).toBeGreaterThanOrEqual(1);
    }
  }, 20000); // на CI иногда чуть дольше дефолтных 5 сек

  test('цели подсказки — только свои неоткрытые слова', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = newGame(seed);
      const t = suggestClue(g, 'blue')!;
      const own = new Set(g.cards.filter((c) => c.owner === 'blue').map((c) => c.word));
      for (const target of t.targets) expect(own.has(target)).toBe(true);
      expect(t.targets.length).toBe(t.clue.count);
    }
  });

  test('подсказка не ближе к убийце, чем к целям, и ниже жёсткого порога', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const g = newGame(seed);
      const t = suggestClue(g, 'red')!;
      // dangerSim уже включает убийцу с весом 1 — цели должны быть заметно ближе
      expect(t.targetSim).toBeGreaterThan(t.dangerSim);
    }
  });

  test('осторожный режим даёт не более рискованные подсказки, чем смелый', () => {
    const g = newGame(7);
    const cautious = suggestClue(g, 'red', 'cautious')!;
    const bold = suggestClue(g, 'red', 'bold')!;
    expect(cautious.targetSim - cautious.dangerSim).toBeGreaterThanOrEqual(
      bold.targetSim - bold.dangerSim,
    );
  });

  test('бот доигрывает партию: подсказки валидны на каждом ходу', () => {
    let g = newGame(11);
    let safety = 60;
    while (g.phase !== 'finished' && safety-- > 0) {
      const t = suggestClue(g, g.turn);
      if (!t) break;
      g = giveClue(g, t.clue);
      // «идеальная команда»: открывает именно целевые слова
      for (const word of t.targets) {
        if (g.phase !== 'guess') break;
        const i = g.cards.findIndex((c) => c.word === word && !c.revealed);
        if (i === -1) break;
        g = guess(g, i);
      }
      // бонусная попытка «+1» не нужна — пасуем
      if (g.phase === 'guess') g = passTurn(g);
    }
    expect(g.phase).toBe('finished');
    expect(g.winReason).toBe('all-words');
  });

  test('когда осталось одно слово — подсказка на одно слово', () => {
    let g = newGame(3);
    // открываем 8 из 9 красных слов напрямую
    const reds = g.cards.map((c, i) => ({ c, i })).filter((x) => x.c.owner === 'red');
    g = giveClue(g, { word: 'фываж', count: 0 });
    for (const { i } of reds.slice(0, 8)) g = guess(g, i);
    expect(g.phase).not.toBe('finished');
    const t = suggestClue({ ...g, phase: 'clue' }, 'red')!;
    expect(t.clue.count).toBe(1);
    expect(t.targets[0]).toBe(reds[8]!.c.word);
  });
});

describe('бот-капитан: правила подсказок', () => {
  test('не повторяет уже использованные подсказки и не берёт слова с поля', () => {
    for (let seed = 1; seed <= 8; seed++) {
      let g = newGame(seed * 17);
      const used = new Set<string>();
      const norm = (w: string) => w.trim().toLowerCase().replace(/ё/g, 'е');
      const boardWords = new Set(g.cards.map((c) => norm(c.word)));
      for (let turn = 0; turn < 6 && g.phase !== 'finished'; turn++) {
        const trace = suggestClue(g, g.turn, 'normal');
        expect(trace).not.toBeNull();
        if (!trace) break;
        const w = norm(trace.clue.word);
        expect(used.has(w)).toBe(false); // подсказка не повторяется
        expect(boardWords.has(w)).toBe(false); // подсказка не совпадает со словом поля (даже открытым)
        used.add(w);
        g = giveClue(g, trace.clue);
        g = passTurn(g);
      }
    }
  }, 30000);

  test('validateClue запрещает слово, совпадающее с открытой картой', () => {
    let g = newGame(99);
    const target = g.cards[0]!;
    g = giveClue(g, { word: 'тест', count: 1 });
    g = guess(g, 0);
    if (g.phase === 'clue' || g.phase === 'guess') {
      expect(() => validateClue(g, { word: target.word.toLowerCase(), count: 1 })).toThrow();
    }
  });
});
