/**
 * Доступ к БД через Prisma. Единственное место, где импортируется @prisma/client.
 * Наружу торчат доменные функции и простые типы — потребителям (apps/server)
 * не нужно знать про Prisma и не нужен сгенерированный клиент для их тайпчека.
 */
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export type GameId = "codenames" | "uno";

export interface UserPublic {
  id: string;
  email: string;
  nickname: string;
  createdAt: Date;
}

export interface UserWithHash extends UserPublic {
  passwordHash: string;
}

export interface UserStats {
  total: number;
  wins: number;
  losses: number;
}

export interface GameResultInput {
  game: GameId;
  userId: string;
  won: boolean;
  team?: string | null;
  score?: number | null;
}

function toPublic(u: {
  id: string;
  email: string;
  nickname: string;
  createdAt: Date;
}): UserPublic {
  return { id: u.id, email: u.email, nickname: u.nickname, createdAt: u.createdAt };
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

export async function getUserStats(userId: string): Promise<UserStats> {
  const [total, wins] = await Promise.all([
    prisma.gameResult.count({ where: { userId } }),
    prisma.gameResult.count({ where: { userId, won: true } }),
  ]);
  return { total, wins, losses: total - wins };
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
