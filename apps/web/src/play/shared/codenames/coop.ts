/**
 * Кооп-режим соло/дуо: 1–2 игрока в одной команде, капитан — бот.
 * Вместо живого соперника — «команда-таймер»: после каждого хода игроков
 * автоматически открывается одно слово соперника.
 */

import type { BotClueTrace, BotRisk } from "./bot";
import { suggestClue } from "./bot";
import { createGame, giveClue, guess, otherTeam, pass } from "./engine";
import type { CodenamesState, Team } from "./types";
import { CodenamesError } from "./types";

export interface CoopGame {
  state: CodenamesState;
  playerTeam: Team;
  timerTeam: Team;
  /** Сколько подсказок взяли игроки (метрика результата). */
  cluesUsed: number;
  /** Последняя подсказка бота с трассой. */
  trace: BotClueTrace | null;
}

/** Новая кооп-партия: игроки всегда стартующая команда (9 слов). */
export function createCoopGame(
  words: string[],
  options: { playerTeam?: Team; random?: () => number } = {},
): CoopGame {
  const playerTeam = options.playerTeam ?? "red";
  const state = createGame(words, {
    startingTeam: playerTeam,
    random: options.random,
  });
  return {
    state,
    playerTeam,
    timerTeam: otherTeam(playerTeam),
    cluesUsed: 0,
    trace: null,
  };
}

/** Открывает одно случайное слово таймер-команды и возвращает ход игрокам. */
function timerReveal(g: CoopGame, random: () => number): CoopGame {
  const s = g.state;
  if (s.phase === "finished") return g;
  const hidden = s.cards
    .map((c, i) => ({ c, i }))
    .filter(x => !x.c.revealed && x.c.owner === g.timerTeam);
  const pick = hidden[Math.floor(random() * hidden.length)];
  if (!pick) return g;

  const cards = s.cards.map((c, i) =>
    i === pick.i ? { ...c, revealed: true } : c,
  );
  const left = hidden.length - 1;
  const finished = left === 0;
  const state: CodenamesState = {
    ...s,
    cards,
    turn: g.playerTeam,
    phase: finished ? "finished" : "clue",
    clue: null,
    guessesLeft: 0,
    winner: finished ? g.timerTeam : null,
    winReason: finished ? "all-words" : null,
    log: [
      ...s.log,
      {
        type: "guess",
        team: g.timerTeam,
        cardIndex: pick.i,
        owner: g.timerTeam,
      },
      ...(finished
        ? [
            {
              type: "gameover" as const,
              winner: g.timerTeam,
              reason: "all-words" as const,
            },
          ]
        : []),
    ],
  };
  return { ...g, state };
}

/** Если ход перешёл к таймер-команде — она сразу «ходит». */
function settle(g: CoopGame, random: () => number): CoopGame {
  if (g.state.phase !== "finished" && g.state.turn === g.timerTeam) {
    return timerReveal(g, random);
  }
  return g;
}

/** Бот-капитан даёт подсказку игрокам. */
export function coopGiveClue(g: CoopGame, risk: BotRisk = "normal"): CoopGame {
  if (g.state.phase === "finished")
    throw new CodenamesError("GAME_FINISHED", "Игра окончена");
  if (g.state.phase !== "clue")
    throw new CodenamesError("WRONG_PHASE", "Сейчас ход игроков");
  const trace = suggestClue(g.state, g.playerTeam, risk);
  if (!trace)
    throw new CodenamesError("INVALID_CLUE_WORD", "Бот не нашёл подсказку");
  return {
    ...g,
    state: giveClue(g.state, trace.clue),
    cluesUsed: g.cluesUsed + 1,
    trace,
  };
}

/** Игроки открывают карточку. */
export function coopGuess(
  g: CoopGame,
  cardIndex: number,
  random: () => number = Math.random,
): CoopGame {
  return settle({ ...g, state: guess(g.state, cardIndex) }, random);
}

/** Игроки останавливаются — таймер-команда сразу открывает своё слово. */
export function coopPass(
  g: CoopGame,
  random: () => number = Math.random,
): CoopGame {
  return settle({ ...g, state: pass(g.state) }, random);
}

export interface CoopResult {
  won: boolean;
  /** Запас: сколько слов таймер-команды осталось закрытыми (чем больше — тем лучше). */
  margin: number;
  cluesUsed: number;
}

/** Итог кооп-партии (только для завершённой игры). */
export function coopResult(g: CoopGame): CoopResult | null {
  if (g.state.phase !== "finished") return null;
  const margin = g.state.cards.filter(
    c => c.owner === g.timerTeam && !c.revealed,
  ).length;
  return {
    won: g.state.winner === g.playerTeam,
    margin,
    cluesUsed: g.cluesUsed,
  };
}
