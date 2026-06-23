import { describe, expect, it } from 'bun:test';
import {
  createMemoryRateLimiter,
  createRedisRateLimiter,
  createRateLimiter,
  type RedisLike,
} from './rateLimit';

describe('createMemoryRateLimiter', () => {
  it('пропускает в пределах лимита и блокирует при превышении (429)', async () => {
    const rl = createMemoryRateLimiter(3, 60_000);
    expect(await rl.limited('ip')).toBe(false);
    expect(await rl.limited('ip')).toBe(false);
    expect(await rl.limited('ip')).toBe(false);
    expect(await rl.limited('ip')).toBe(true); // 4-й за окно
  });

  it('независимые ключи', async () => {
    const rl = createMemoryRateLimiter(1, 60_000);
    expect(await rl.limited('a')).toBe(false);
    expect(await rl.limited('b')).toBe(false);
    expect(await rl.limited('a')).toBe(true);
  });
});

describe('createRedisRateLimiter', () => {
  function fakeRedis(): RedisLike & { store: Map<string, number> } {
    const store = new Map<string, number>();
    return {
      store,
      async incr(k) {
        const n = (store.get(k) ?? 0) + 1;
        store.set(k, n);
        return n;
      },
      async pExpire() {
        return 1;
      },
    };
  }

  it('считает общий счётчик и блокирует при превышении', async () => {
    const rl = createRedisRateLimiter(fakeRedis(), 2, 60_000);
    expect(await rl.limited('login:1.2.3.4')).toBe(false);
    expect(await rl.limited('login:1.2.3.4')).toBe(false);
    expect(await rl.limited('login:1.2.3.4')).toBe(true);
  });

  it('fail-open при сбое Redis (incr бросает) + onError', async () => {
    let errCalled = false;
    const broken: RedisLike = {
      async incr() {
        throw new Error('redis down');
      },
      async pExpire() {
        return 1;
      },
    };
    const rl = createRedisRateLimiter(broken, 1, 60_000, () => {
      errCalled = true;
    });
    expect(await rl.limited('x')).toBe(false); // не блокируем
    expect(errCalled).toBe(true);
  });
});

describe('createRateLimiter (фабрика)', () => {
  it('без redisUrl → in-memory', async () => {
    const rl = createRateLimiter(1, 60_000, {});
    expect(await rl.limited('k')).toBe(false);
    expect(await rl.limited('k')).toBe(true);
  });

  it('с redisUrl + connectRedis → redis-путь', async () => {
    const store = new Map<string, number>();
    const rl = createRateLimiter(1, 60_000, {
      redisUrl: 'redis://x',
      connectRedis: () => ({
        async incr(k) {
          const n = (store.get(k) ?? 0) + 1;
          store.set(k, n);
          return n;
        },
        async pExpire() {
          return 1;
        },
      }),
    });
    expect(await rl.limited('k')).toBe(false);
    expect(await rl.limited('k')).toBe(true);
    expect(store.get('rl:k')).toBe(2);
  });
});
