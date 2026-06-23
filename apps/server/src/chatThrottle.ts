/**
 * Per-key троттлинг частоты сообщений (sliding window) для `chat:send`.
 * Защищает чат комнаты от флуда: один сокет не может слать чаще, чем
 * `limit` сообщений за `windowMs`. Без внешних зависимостей — состояние
 * в памяти процесса (per-socket, ключ = socket.id), чего достаточно:
 * socket.id уникален в рамках инстанса, который и держит соединение.
 *
 * Бизнес-валидация (длина, пустота) остаётся в `addChat` менеджера —
 * здесь только ограничение частоты.
 */
export interface ChatThrottle {
  /** true — сообщение разрешено; false — лимит частоты превышен. */
  allow(key: string, now?: number): boolean;
  /** Забывает состояние ключа (вызывать на disconnect, чтобы не копить мусор). */
  forget(key: string): void;
}

/** Дефолт: не более 5 сообщений за 5 секунд на сокет. */
export function createChatThrottle(limit = 5, windowMs = 5_000): ChatThrottle {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string, now: number = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
    forget(key: string): void {
      hits.delete(key);
    },
  };
}
