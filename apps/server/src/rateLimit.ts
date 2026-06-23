/**
 * Rate-limiter для auth-роутов. Два бэкенда (аудит безопасности §rate-limit):
 *
 * - **in-memory** (по умолчанию / single-node / dev): Map по ключу, окно сброса.
 *   Поведение идентично прежнему `rateHits` в routes.ts.
 * - **Redis** (при заданном REDIS_URL / multi-node): INCR + PEXPIRE по ключу
 *   `rl:<key>` — счётчик ОБЩИЙ для всех инстансов за балансировщиком, поэтому
 *   лимит «N за окно» глобальный, а не «N на инстанс».
 *
 * Redis-операции fail-open: при сбое Redis запрос НЕ блокируется (доступность
 * важнее, чем строгость лимита во время аварии) — с логированием warning.
 */
export interface RateLimiter {
  /** true — лимит превышен (запрос следует отклонить 429). */
  limited(key: string): Promise<boolean>;
}

/** In-memory limiter (single-node / dev). */
export function createMemoryRateLimiter(limit: number, windowMs: number): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    limited(key: string): Promise<boolean> {
      const now = Date.now();
      // Периодическая чистка устаревших ключей, чтобы Map не рос бесконечно.
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
      }
      const entry = hits.get(key);
      if (!entry || now > entry.resetAt) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return Promise.resolve(false);
      }
      entry.count += 1;
      return Promise.resolve(entry.count > limit);
    },
  };
}

/** Минимальный интерфейс Redis-клиента, нужный лимитеру (node-redis v4). */
export interface RedisLike {
  incr(key: string): Promise<number>;
  pExpire(key: string, ms: number): Promise<unknown>;
}

/** Redis-backed limiter (multi-node): общий счётчик INCR + PEXPIRE. */
export function createRedisRateLimiter(
  client: RedisLike,
  limit: number,
  windowMs: number,
  onError?: (e: unknown) => void,
): RateLimiter {
  return {
    async limited(key: string): Promise<boolean> {
      try {
        const count = await client.incr(`rl:${key}`);
        // Ставим TTL только при первом инкременте окна.
        if (count === 1) await client.pExpire(`rl:${key}`, windowMs);
        return count > limit;
      } catch (e) {
        onError?.(e);
        return false; // fail-open: при сбое Redis не блокируем легитимных
      }
    },
  };
}

export interface RateLimiterLogger {
  warn(msg: string): void;
}

/**
 * Фабрика: при заданном `redisUrl` (или env REDIS_URL) — Redis-лимитер с лениво
 * подключаемым клиентом; иначе in-memory. Конкретный redis-клиент инъектируется
 * через `connectRedis` (упрощает тесты и не тащит зависимость в этот модуль).
 */
export function createRateLimiter(
  limit: number,
  windowMs: number,
  opts: {
    redisUrl?: string;
    log?: RateLimiterLogger;
    connectRedis?: (url: string) => RedisLike;
  } = {},
): RateLimiter {
  const redisUrl = opts.redisUrl ?? process.env.REDIS_URL;
  if (!redisUrl || !opts.connectRedis) {
    return createMemoryRateLimiter(limit, windowMs);
  }
  const client = opts.connectRedis(redisUrl);
  return createRedisRateLimiter(client, limit, windowMs, (e) =>
    opts.log?.warn(`rate-limit redis op failed: ${(e as Error).message}`),
  );
}
