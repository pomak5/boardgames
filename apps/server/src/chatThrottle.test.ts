import { describe, expect, it } from 'bun:test';
import { createChatThrottle } from './chatThrottle';

describe('createChatThrottle', () => {
  it('пропускает сообщения в пределах лимита', () => {
    const t = createChatThrottle(3, 1000);
    expect(t.allow('a', 0)).toBe(true);
    expect(t.allow('a', 100)).toBe(true);
    expect(t.allow('a', 200)).toBe(true);
  });

  it('блокирует при превышении лимита в окне', () => {
    const t = createChatThrottle(3, 1000);
    t.allow('a', 0);
    t.allow('a', 100);
    t.allow('a', 200);
    expect(t.allow('a', 300)).toBe(false);
  });

  it('снова пропускает после выхода старых хитов из окна', () => {
    const t = createChatThrottle(3, 1000);
    t.allow('a', 0);
    t.allow('a', 100);
    t.allow('a', 200);
    expect(t.allow('a', 300)).toBe(false);
    // окно 1000мс: к t=1100 первый хит (t=0) уже устарел
    expect(t.allow('a', 1100)).toBe(true);
  });

  it('считает ключи независимо', () => {
    const t = createChatThrottle(1, 1000);
    expect(t.allow('a', 0)).toBe(true);
    expect(t.allow('b', 0)).toBe(true);
    expect(t.allow('a', 0)).toBe(false);
    expect(t.allow('b', 0)).toBe(false);
  });

  it('forget сбрасывает состояние ключа', () => {
    const t = createChatThrottle(1, 1000);
    expect(t.allow('a', 0)).toBe(true);
    expect(t.allow('a', 0)).toBe(false);
    t.forget('a');
    expect(t.allow('a', 0)).toBe(true);
  });
});
