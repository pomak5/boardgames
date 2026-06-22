/**
 * Periodic refresh materialized view лидерборда (аудит §6).
 *
 * `leaderboard_mv` агрегирует wins/total по userId из `GameResult`. Без
 * периодического обновления она устаревает (новые результаты не видны в
 * лидерборде). Refresh запускается по интервалу + один раз при старте сервера.
 *
 * `REFRESH MATERIALIZED VIEW CONCURRENTLY` не блокирует чтение (читающие запросы
 * видят старую версию до завершения refresh) и не требует exclusive lock;
 * требует unique index на matview (создан миграцией
 * `20260621120000_leaderboard_matview`).
 *
 * Lazy import `@boardgames/db` — модуль грузится только под DATABASE_URL
 * (wiring в index.ts), чтобы guest-only режим не тащил Prisma-клиент.
 */
interface RefreshLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 минут

export function startLeaderboardRefresh(log: RefreshLogger): () => void {
  const intervalMs = Number(process.env.LEADERBOARD_REFRESH_MS ?? DEFAULT_INTERVAL_MS);

  const refresh = async (): Promise<void> => {
    try {
      const { prisma } = await import('@boardgames/db');
      await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY "leaderboard_mv"`;
    } catch (e) {
      // Первые запуски на пустой БД/без матвью — не фатально; janitor-like лог.
      log.warn(`leaderboard refresh failed: ${(e as Error).message}`);
    }
  };

  // При старте — сразу, чтобы matview была актуальной после деплоя/рестарта
  // (иначе до первого интервального тика лидерборд пуст/устарел).
  void refresh();
  const handle = setInterval(refresh, intervalMs);
  log.info(`leaderboard refresh job started (interval ${intervalMs}ms)`);

  return () => {
    clearInterval(handle);
  };
}
