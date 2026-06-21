/**
 * Janitor: фоновая чистка зомби-комнат. Аудит §4 (HIGH): сервер хранит комнаты в
 * RAM, а таймеры — в `setTimeout`. Если сокет клиента ушёл в лимбо (мобайл-фоновый
 * режим, TCP-timeout) и `disconnect` не сработал, `leave()` не вызывается — комната
 * висит с `turnDeadline` в прошлом и без живых сокетов. После деплоя/рестарта
 * процесса все `setTimeout` теряются, но RAM-комнаты исчезают и так; janitor же
 * закрывает именно «лимбо»-случай и зависшие playing-комнаты.
 *
 * Прагматичный вариант (без полного persist-снапшота — тот отдельная MED §1):
 * раз в минуту обходим комнаты каждой игры и удаляем те, у которых нет ни одного
 * живого сокета в неймспейсе. Для playing-комнат — grace-период по существующему
 * `turnDeadline` (игрок успеет реконнектнуться после reload/обрыва); lobby и
 * finished без живых сокетов удаляются сразу. Никаких новых полей на комнатах.
 *
 * Таймеры комнат self-guarded (`if (!manager.get(code)) return`), так что удаление
 * карты даже без `clearTimeout` безопасно; но мы чистим таймер явно для порядка.
 */
import type { Namespace } from 'socket.io';

/** Хендл чистки, который менеджер игры отдаёт наружу из `register`. */
export interface Janitable {
  /**
   * Чистит зомби-комнаты. `hasLiveSocket(code)` проверяет, есть ли в неймспейсе
   * хоть один сокет, привязанный к этому коду комнаты. Возвращает коды удалённых
   * комнат (для лога).
   */
  cleanupStale(hasLiveSocket: (code: string) => boolean, now: number, graceMs: number): string[];
  /**
   * Восстанавливает комнаты из Redis-снапшотов при старте сервера (аудит §1).
   * Принимает массив plain-объектов (из persist.loadAllRooms), реконструирует
   * комнаты и кладёт их в manager. Возвращает количество восстановленных.
   */
  restore?(snapshots: Array<{ code: string; state: unknown }>): number;
}

/** Интервал обхода (раз в минуту). */
export const JANITOR_INTERVAL_MS = 60_000;
/**
 * Grace для playing-комнат без живых сокетов: даём игроку 5 минут на реконнект
 * (после обрыва/reload), прежде чем признать комнату зомби. Считаем от
 * `turnDeadline` (момент, когда ход должен был завершиться) — если с тех пор
 * прошло больше grace, никто уже не вернётся.
 */
export const JANITOR_GRACE_MS = 5 * 60_000;

export interface JanitorLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
}

export interface JanitorGame {
  namespace: string;
  name: string;
  janitor?: Janitable;
}

/**
 * Запускает janitor. Возвращает функцию остановки (для graceful shutdown / тестов).
 * `nspOf(namespace)` резолвит неймспейс — из него janitor берёт актуальный список
 * сокетов, чтобы отличить «комната без сокетов» от «комната с живыми игроками».
 */
export function startJanitor(
  games: ReadonlyArray<JanitorGame>,
  nspOf: (namespace: string) => Namespace,
  log: JanitorLogger,
): () => void {
  const tick = (): void => {
    const now = Date.now();
    for (const g of games) {
      if (!g.janitor) continue;
      const nsp = nspOf(g.namespace);
      try {
        const deleted = g.janitor.cleanupStale(
          (code) => hasLiveSocket(nsp, code),
          now,
          JANITOR_GRACE_MS,
        );
        if (deleted.length > 0)
          log.info(
            `janitor[${g.name}] removed ${deleted.length} stale room(s): ${deleted.join(', ')}`,
          );
      } catch (e) {
        log.warn(`janitor[${g.name}] tick failed: ${(e as Error).message}`);
      }
    }
  };
  const handle = setInterval(tick, JANITOR_INTERVAL_MS);
  // Не звеним на старте — комната ещё пустые; таймер selbst снимется при shutdown.
  handle.unref?.();
  return () => clearInterval(handle);
}

/** Есть ли в неймспейсе хоть один сокет, привязанный к коду комнаты. */
function hasLiveSocket(nsp: Namespace, code: string): boolean {
  for (const [, socket] of nsp.sockets) {
    if ((socket.data as { roomCode?: string } | null)?.roomCode === code) return true;
  }
  return false;
}
