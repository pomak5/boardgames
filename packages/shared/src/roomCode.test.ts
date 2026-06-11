import { describe, expect, test } from 'bun:test';
import { generateRoomCode, isValidRoomCode } from './roomCode';

describe('generateRoomCode', () => {
  test('формат XXX-XXX', () => {
    for (let i = 0; i < 200; i++) {
      expect(isValidRoomCode(generateRoomCode())).toBe(true);
    }
  });
  test('не содержит похожих символов 0/O/1/I/L', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateRoomCode()).not.toMatch(/[01OIL]/);
    }
  });
  test('детерминирован при фиксированном random', () => {
    expect(generateRoomCode(() => 0)).toBe('AAA-AAA');
  });
});

describe('isValidRoomCode', () => {
  test('отклоняет мусор', () => {
    for (const bad of ['', 'abc-def', 'AAAAAA', 'AA1-O00', 'AAA_AAA']) {
      expect(isValidRoomCode(bad)).toBe(false);
    }
  });
});
