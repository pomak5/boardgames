import { describe, expect, test } from 'bun:test';
import { pickWords } from './dictionary';
import { BOARD_SIZE } from './engine';
import { coopGiveClue, coopGuess, coopPass, coopResult, createCoopGame } from './coop';
import type { CoopGame } from './coop';

const seeded = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

const newCoop = (seed: number): CoopGame =>
  createCoopGame(pickWords(BOARD_SIZE, seeded(seed)), { random: seeded(seed) });

const find = (g: CoopGame, owner: string) =>
  g.state.cards.findIndex((c) => c.owner === owner && !c.revealed);

describe('кооп-режим', () => {
  test('игроки — стартующая команда с 9 словами', () => {
    const g = newCoop(1);
    expect(g.playerTeam).toBe('red');
    expect(g.state.turn).toBe('red');
    expect(g.state.cards.filter((c) => c.owner === 'red').length).toBe(9);
  });

  test('после паса таймер-команда открывает ровно одно своё слово и ход возвращается', () => {
    let g = coopGiveClue(newCoop(2));
    g = coopPass(g, seeded(2));
    const timerRevealed = g.state.cards.filter((c) => c.owner === g.timerTeam && c.revealed);
    expect(timerRevealed.length).toBe(1);
    expect(g.state.turn).toBe(g.playerTeam);
    expect(g.state.phase).toBe('clue');
  });

  test('ошибка игроков (чужое/нейтральное) тоже запускает таймер', () => {
    let g = coopGiveClue(newCoop(3));
    g = coopGuess(g, find(g, 'neutral'), seeded(3));
    expect(g.state.cards.filter((c) => c.owner === g.timerTeam && c.revealed).length).toBe(1);
    expect(g.state.turn).toBe(g.playerTeam);
  });

  test('игроки выигрывают, открыв все свои слова', () => {
    let g = newCoop(4);
    while (g.state.phase !== 'finished') {
      if (g.state.phase === 'clue') g = coopGiveClue(g);
      const i = find(g, 'red');
      g = coopGuess(g, i, seeded(4));
    }
    const r = coopResult(g)!;
    expect(r.won).toBe(true);
    expect(r.margin).toBeGreaterThan(0);
    expect(r.cluesUsed).toBeGreaterThan(0);
  });

  test('поражение: таймер-команда закончилась раньше', () => {
    let g = newCoop(5);
    let safety = 30;
    while (g.state.phase !== 'finished' && safety-- > 0) {
      if (g.state.phase === 'clue') g = coopGiveClue(g);
      g = coopPass(g, seeded(5)); // игроки «ничего не угадывают»
    }
    const r = coopResult(g)!;
    expect(r.won).toBe(false);
    expect(r.margin).toBe(0);
  });

  test('убийца — мгновенное поражение, таймер не ходит', () => {
    let g = coopGiveClue(newCoop(6));
    const before = g.state.cards.filter((c) => c.owner === g.timerTeam && c.revealed).length;
    g = coopGuess(g, find(g, 'assassin'), seeded(6));
    expect(g.state.phase).toBe('finished');
    expect(g.state.winner).toBe(g.timerTeam);
    expect(g.state.winReason).toBe('assassin');
    expect(g.state.cards.filter((c) => c.owner === g.timerTeam && c.revealed).length).toBe(before);
  });

  test('coopResult для незавершённой игры — null', () => {
    expect(coopResult(newCoop(7))).toBeNull();
  });

  test('подсказку нельзя просить в фазе отгадывания', () => {
    const g = coopGiveClue(newCoop(8));
    expect(() => coopGiveClue(g)).toThrow();
  });
});
