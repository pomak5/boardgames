-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameResult" (
    "id" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "won" BOOLEAN NOT NULL,
    "team" TEXT,
    "score" INTEGER,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AliasWord" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,

    CONSTRAINT "AliasWord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "GameResult_userId_idx" ON "GameResult"("userId");

-- CreateIndex
CREATE INDEX "GameResult_userId_won_idx" ON "GameResult"("userId", "won");

-- CreateIndex
CREATE INDEX "GameResult_userId_playedAt_idx" ON "GameResult"("userId", "playedAt");

-- CreateIndex
CREATE INDEX "GameResult_game_idx" ON "GameResult"("game");

-- CreateIndex
CREATE UNIQUE INDEX "AliasWord_word_key" ON "AliasWord"("word");

-- CreateIndex
CREATE INDEX "AliasWord_difficulty_idx" ON "AliasWord"("difficulty");

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

