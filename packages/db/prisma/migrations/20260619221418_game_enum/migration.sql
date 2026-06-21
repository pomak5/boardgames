/*
  Warnings:

  - Changed the type of `game` on the `GameResult` table. No cast exists, so
    Prisma would drop+recreate the column — unacceptable with existing data.
    Manually rewritten below to ALTER TYPE ... USING "game"::"Game", preserving
    rows (existing values are all 'codenames'/'uno'/'alias', valid for the enum).
*/
-- CreateEnum
CREATE TYPE "Game" AS ENUM ('codenames', 'uno', 'alias');

-- AlterTable: String → Game с кастом существующих значений (без потери данных)
ALTER TABLE "GameResult" ALTER COLUMN "game" DROP DEFAULT;
ALTER TABLE "GameResult" ALTER COLUMN "game" TYPE "Game" USING "game"::"Game";
ALTER TABLE "GameResult" ALTER COLUMN "game" SET NOT NULL;

-- Индекс "GameResult_game_idx" уже создан миграцией init (@@index([game]));
-- Prisma пытается пересоздать его — убираем, чтобы не было дубликата/ошибки.
