/**
 * Доступ к БД через Prisma. Единственное место, где импортируется @prisma/client.
 * Наружу торчат доменные функции и простые типы — потребителям (apps/server)
 * не нужно знать про Prisma и не нужен сгенерированный клиент для их тайпчека.
 */
import { PrismaClient } from '@prisma/client';

// log: предупреждения/ошибки Prisma (напр. исчерпание connection pool) попадают в
// консоль сервера. Connection limit/pool timeout настраиваются через DATABASE_URL
// (см. docs/database.md «Connection pool / PgBouncer»), не через конструктор —
// таково API Prisma 6.
export const prisma = new PrismaClient({ log: ['warn', 'error'] });

export type GameId = 'codenames' | 'uno' | 'alias' | 'imaginarium';

export interface UserPublic {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  createdAt: Date;
}

export interface UserWithHash extends UserPublic {
  passwordHash: string;
}

export interface GameStats {
  total: number;
  wins: number;
  losses: number;
}

/** Сводная статистика игрока: общая + разбивка по играм. */
export interface UserStats extends GameStats {
  byGame: Record<GameId, GameStats>;
}

export interface GameResultInput {
  game: GameId;
  userId: string;
  won: boolean;
  team?: string | null;
  score?: number | null;
}

export interface RecentResult {
  game: GameId;
  won: boolean;
  team: string | null;
  score: number | null;
  playedAt: Date;
}

export interface LeaderboardEntry {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  wins: number;
  total: number;
}

function toPublic(u: {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  createdAt: Date;
}): UserPublic {
  return {
    id: u.id,
    email: u.email,
    nickname: u.nickname,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt,
  };
}

export async function createUser(
  email: string,
  nickname: string,
  passwordHash: string,
): Promise<UserPublic> {
  const u = await prisma.user.create({
    data: { email: email.toLowerCase(), nickname, passwordHash },
  });
  return toPublic(u);
}

export async function findUserByEmail(email: string): Promise<UserWithHash | null> {
  const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  return u ? { ...toPublic(u), passwordHash: u.passwordHash } : null;
}

export async function getUserById(id: string): Promise<UserPublic | null> {
  const u = await prisma.user.findUnique({ where: { id } });
  return u ? toPublic(u) : null;
}

export async function updateUserAvatar(
  userId: string,
  avatarUrl: string | null,
): Promise<UserPublic> {
  const u = await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
  return toPublic(u);
}

export async function recordGameResult(r: GameResultInput): Promise<void> {
  await prisma.gameResult.create({
    data: {
      game: r.game,
      userId: r.userId,
      won: r.won,
      team: r.team ?? null,
      score: r.score ?? null,
    },
  });
}

function emptyStats(): GameStats {
  return { total: 0, wins: 0, losses: 0 };
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const rows = await prisma.gameResult.groupBy({
    by: ['game', 'won'],
    where: { userId },
    _count: { _all: true },
  });
  const byGame: Record<GameId, GameStats> = {
    codenames: emptyStats(),
    uno: emptyStats(),
    alias: emptyStats(),
    imaginarium: emptyStats(),
  };
  const overall = emptyStats();
  for (const r of rows) {
    const count = r._count._all;
    const bucket = byGame[r.game as GameId] ?? (byGame[r.game as GameId] = emptyStats());
    bucket.total += count;
    overall.total += count;
    if (r.won) {
      bucket.wins += count;
      overall.wins += count;
    } else {
      bucket.losses += count;
      overall.losses += count;
    }
  }
  return { ...overall, byGame };
}

export async function getRecentResults(userId: string, limit = 30): Promise<RecentResult[]> {
  const rows = await prisma.gameResult.findMany({
    where: { userId },
    orderBy: { playedAt: 'desc' },
    take: limit,
    select: { game: true, won: true, team: true, score: true, playedAt: true },
  });
  return rows.map((r) => ({
    game: r.game as GameId,
    won: r.won,
    team: r.team,
    score: r.score,
    playedAt: r.playedAt,
  }));
}

/**
 * Лидерборд из materialized view `leaderboard_mv` (аудит §6) — pre-aggregated
 * wins/total по userId. Раньше: 2 full-table `groupBy` по всей `GameResult`
 * без `where` — деградировало с ростом таблицы. Теперь: один SELECT из matview
 * + JOIN User, сортировка и лимит на стороне БД.
 *
 * Matview наполняется/обновляется серверным refresh-job
 * (`apps/server/src/leaderboard-refresh.ts`): один раз при старте + по интервалу
 * (LEADERBOARD_REFRESH_MS, по умолчанию 5 мин) через `REFRESH MATERIALIZED VIEW
 * CONCURRENTLY`. До первого refresh (или если БД пуста) возвращает [].
 */
export async function getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  const rows = await prisma.$queryRaw<
    { userId: string; nickname: string; avatarUrl: string | null; wins: number; total: number }[]
  >`
    SELECT mv."userId", mv."wins", mv."total",
           u."nickname", u."avatarUrl"
    FROM "leaderboard_mv" mv
    JOIN "User" u ON u."id" = mv."userId"
    ORDER BY mv."wins" DESC, mv."total" DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    userId: r.userId,
    nickname: r.nickname ?? '—',
    avatarUrl: r.avatarUrl ?? null,
    wins: r.wins,
    total: r.total,
  }));
}

export async function seedAliasWords(
  words: { word: string; difficulty: string }[],
): Promise<number> {
  const res = await prisma.aliasWord.createMany({
    data: words.map((w) => ({ word: w.word.toLowerCase(), difficulty: w.difficulty })),
    skipDuplicates: true,
  });
  return res.count;
}

export async function listAliasWords(difficulty?: string): Promise<string[]> {
  const rows = await prisma.aliasWord.findMany({
    where: difficulty ? { difficulty } : undefined,
    select: { word: true },
  });
  return rows.map((r) => r.word);
}
