import { describe, expect, test } from 'bun:test';
import {
  createAliasGame,
  endRound,
  finishGame,
  markGuessed,
  markSkipped,
  startRound,
} from './engine';
import type { AliasState } from './types';

const seeded = (seed = 42) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

const startFirst = (state: AliasState, word = 'кот'): AliasState =>
  startRound(state, {
    team: state.currentTeam,
    explainer: 'p1',
    word,
    startedAt: 1000,
  });

describe('createAliasGame', () => {
  test('стартует в фазе between, счёт 0:0', () => {
    const g = createAliasGame({ random: seeded(1) });
    expect(g.phase).toBe('between');
    expect(g.scores.red).toBe(0);
    expect(g.scores.blue).toBe(0);
    expect(g.winner).toBeNull();
    expect(g.round).toBeNull();
    expect(g.teams).toEqual(['red', 'blue']);
  });

  test('настройки применяются', () => {
    const g = createAliasGame({
      targetScore: 50,
      roundDuration: 90,
      difficulty: 'hard',
      startingTeam: 'blue',
    });
    expect(g.targetScore).toBe(50);
    expect(g.roundDuration).toBe(90);
    expect(g.difficulty).toBe('hard');
    expect(g.currentTeam).toBe('blue');
  });
});

describe('startRound', () => {
  test('переводит в фазу round, фиксирует слово и объясняющего', () => {
    const g = startFirst(createAliasGame({ startingTeam: 'red' }), 'дерево');
    expect(g.phase).toBe('round');
    expect(g.round?.word).toBe('дерево');
    expect(g.round?.guessed).toBe(0);
    expect(g.explainer).toBe('p1');
    expect(g.currentTeam).toBe('red');
    expect(g.log[0]).toEqual({ type: 'round-start', team: 'red', explainer: 'p1' });
  });

  test('нельзя стартовать раунд поверх идущего', () => {
    const g = startFirst(createAliasGame());
    expect(() => startRound(g, { team: 'red', explainer: 'p1', word: 'x' })).toThrow();
  });
});

describe('markGuessed', () => {
  test('+1 к счёту команды, следующее слово показано', () => {
    const g = markGuessed(startFirst(createAliasGame({ startingTeam: 'red' }), 'кот'), 'пёс');
    expect(g.scores.red).toBe(1);
    expect(g.round?.word).toBe('пёс');
    expect(g.round?.guessed).toBe(1);
    expect(g.usedWords).toContain('кот');
    expect(g.phase).toBe('round');
  });

  test('nextWord=null завершает раунд', () => {
    const g = markGuessed(startFirst(createAliasGame({ startingTeam: 'red' }), 'кот'), null);
    expect(g.scores.red).toBe(1);
    expect(g.phase).toBe('between');
    expect(g.round).toBeNull();
  });

  test('нельзя вне раунда', () => {
    expect(() => markGuessed(createAliasGame(), 'x')).toThrow();
  });
});

describe('markSkipped', () => {
  test('−1 к счёту (не ниже 0), слово в использованных', () => {
    const base = createAliasGame({ startingTeam: 'red' });
    // сначала заработаем 2 очка
    let g = markGuessed(startFirst(base, 'а'), 'б');
    g = markGuessed(g, 'в');
    expect(g.scores.red).toBe(2);
    g = markSkipped(g, 'г');
    expect(g.scores.red).toBe(1);
    expect(g.round?.word).toBe('г');
    expect(g.usedWords).toContain('в');
  });

  test('пропуск при 0 не уводит в минус', () => {
    const g = markSkipped(startFirst(createAliasGame({ startingTeam: 'red' }), 'а'), 'б');
    expect(g.scores.red).toBe(0);
    expect(g.round?.word).toBe('б');
  });
});

describe('endRound (таймер)', () => {
  test('текущее слово сгорает: не в usedWords и без очков', () => {
    const g = endRound(startFirst(createAliasGame({ startingTeam: 'red' }), 'сгоревшее'));
    expect(g.phase).toBe('between');
    expect(g.round).toBeNull();
    expect(g.usedWords).not.toContain('сгоревшее');
    expect(g.scores.red).toBe(0);
    expect(g.log.at(-1)).toEqual({ type: 'round-end', team: 'red', guessed: 0, skipped: 0 });
  });
});

describe('finishGame', () => {
  test('фиксирует победителя и фазу finished', () => {
    const g = finishGame(createAliasGame(), 'red');
    expect(g.phase).toBe('finished');
    expect(g.winner).toBe('red');
    expect(g.log.at(-1)).toEqual({ type: 'gameover', winner: 'red' });
  });

  test('нельзя финалить дважды', () => {
    const g = finishGame(createAliasGame(), 'red');
    expect(() => finishGame(g, 'blue')).toThrow();
  });
});
