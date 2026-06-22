-- Materialized view для лидерборда (аудит §6): pre-aggregated wins/total по userId.
-- Заменяет 2 full-table groupBy в getLeaderboard (packages/db/src/index.ts).
-- REFRESH MATERIALIZED VIEW CONCURRENTLY требует unique index — создаём сразу
-- после matview. Refresh запускается сервером (apps/server/src/leaderboard-refresh.ts)
-- по интервалу + один раз при старте.
CREATE MATERIALIZED VIEW IF NOT EXISTS "leaderboard_mv" AS
  SELECT "userId"                       AS "userId",
         count(*)::int                  AS "total",
         count(*) FILTER (WHERE "won")::int AS "wins"
  FROM "GameResult"
  GROUP BY "userId";

CREATE UNIQUE INDEX IF NOT EXISTS "leaderboard_mv_userId_key"
  ON "leaderboard_mv" ("userId");
