/**
 * Persist-снапшоты комнат в Redis (аудит §1, write-side). Сохраняет сериализуемое
 * состояние комнаты при смысловых сменах состояния (ход, фаза, состав) — чтобы
 * при рестарте сервера восстановить активные партии (restore-on-startup —
 * scaffold, см. index.ts, флаг PERSIST_RESTORE).
 *
 * Использует ОТДЕЛЬНЫЙ redis-клиент (обычный, не pub/sub из socket.io-адаптера).
 * Env-gated через REDIS_URL: без него — persist недоступен, snapshotRoom — no-op.
 *
 * Сериализация: JSON.stringify. Map (codenames/alias players) → массив entries
 * (готовится в менеджерах перед snapshot). `UnoState.random` (функция) выкинется
 * из JSON — ОК (при restore менеджер подставит новый Math.random). `Infinity`
 * больше не встречается (§3 фикс: null вместо Infinity).
 *
 * Ошибки redis в hot-path НЕ бросают — логируются, игра продолжается. Снапшот —
 * best-effort: потеря снапшота не роняет партию (комната живёт в RAM).
 */
import { createClient, type RedisClientType } from 'redis';

const REDIS_URL = process.env.REDIS_URL;
const KEY_PREFIX = 'persist';
/** TTL снапшота: если комната не обновлялась час — ключ истекает (не копится). */
const DEFAULT_TTL_SEC = 3600;

let client: RedisClientType | null = null;

/** True, если persist настроен (REDIS_URL задан). Snapshot/write доступен. */
export function persistAvailable(): boolean {
  return !!REDIS_URL;
}

async function getClient(): Promise<RedisClientType> {
  if (client) return client;
  if (!REDIS_URL) throw new Error('REDIS_URL not set — persist unavailable');
  const c = createClient({ url: REDIS_URL }) as RedisClientType;
  await c.connect();
  client = c;
  return client;
}

function key(prefix: string, code: string): string {
  return `${KEY_PREFIX}:${prefix}:${code}`;
}

/**
 * Сохраняет сериализованное состояние комнаты в Redis (SET ... EX ttlSec).
 * Best-effort: ошибки логируются в console.error, не бросают.
 * Вызывайте ТОЛЬКО на смысловых сменах состояния (не на каждом чате).
 */
export async function snapshotRoom(
  prefix: 'codenames' | 'uno' | 'alias',
  code: string,
  state: unknown,
  ttlSec = DEFAULT_TTL_SEC,
): Promise<void> {
  if (!REDIS_URL) return;
  try {
    const c = await getClient();
    const json = JSON.stringify(state);
    await c.set(key(prefix, code), json, { EX: ttlSec });
  } catch (e) {
    console.error(`[persist] snapshotRoom(${prefix}:${code}) failed:`, (e as Error).message);
  }
}

/**
 * Удаляет снапшот комнаты (при закрытии/janitor-cleanup).
 * Best-effort: ошибки логируются, не бросают.
 */
export async function deleteRoom(
  prefix: 'codenames' | 'uno' | 'alias',
  code: string,
): Promise<void> {
  if (!REDIS_URL) return;
  try {
    const c = await getClient();
    await c.del(key(prefix, code));
  } catch (e) {
    console.error(`[persist] deleteRoom(${prefix}:${code}) failed:`, (e as Error).message);
  }
}

/**
 * Загружает все снапшоты комнат для restore-on-startup (scaffold).
 * KEYS persist:<prefix>:* → MGET → parse. Не используется в hot-path.
 */
export async function loadAllRooms(
  prefix: 'codenames' | 'uno' | 'alias',
): Promise<Array<{ code: string; state: unknown }>> {
  if (!REDIS_URL) return [];
  const c = await getClient();
  const pattern = `${KEY_PREFIX}:${prefix}:*`;
  const keys = await c.keys(pattern);
  if (keys.length === 0) return [];
  const values = await c.mGet(keys);
  const result: Array<{ code: string; state: unknown }> = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]!;
    const v = values[i];
    if (v) {
      const code = k.split(':').slice(2).join(':');
      try {
        result.push({ code, state: JSON.parse(v) });
      } catch {
        // битый JSON — пропускаем
      }
    }
  }
  return result;
}

/** Закрывает redis-клиент (graceful shutdown). */
export async function closePersist(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
