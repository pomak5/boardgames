import { describe, expect, it } from 'bun:test';
import { originAllowed, parseAllowedOrigins } from './origin';

describe('parseAllowedOrigins', () => {
  it('парсит список через запятую и тримит', () => {
    expect(parseAllowedOrigins('https://a.com, https://b.com')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });
  it('использует fallback если не задано', () => {
    expect(parseAllowedOrigins(undefined)).toEqual(['http://localhost:5173']);
  });
});

describe('originAllowed', () => {
  const allowed = ['https://play.example.com'];

  it('пропускает совпадающий Origin', () => {
    expect(originAllowed('https://play.example.com', undefined, allowed)).toBe(true);
  });

  it('отклоняет чужой Origin (CSRF)', () => {
    expect(originAllowed('https://evil.com', undefined, allowed)).toBe(false);
  });

  it('падает на Referer когда Origin отсутствует', () => {
    expect(originAllowed(undefined, 'https://play.example.com/lobby', allowed)).toBe(true);
    expect(originAllowed(undefined, 'https://evil.com/x', allowed)).toBe(false);
  });

  it('пропускает запрос без Origin и Referer (same-origin/не-браузер)', () => {
    expect(originAllowed(undefined, undefined, allowed)).toBe(true);
  });

  it('отклоняет битый Referer', () => {
    expect(originAllowed(undefined, 'not-a-url', allowed)).toBe(false);
  });
});
