/** Комнаты Коднеймс на Convex: создание/вход по коду, команды, ходы, бот-капитан, чат. */
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  BOARD_SIZE,
  createGame,
  generateRoomCode,
  giveClue as engineGiveClue,
  guess as engineGuess,
  pass as enginePass,
  pickWords,
  redactCodenames,
  suggestClue,
} from "./engine";
import type {
  ChatMessage,
  Clue,
  CodenamesState,
  PlayerRole,
  RoomPlayer,
  RoomSettings,
  Team,
} from "./engine";

const MAX_PLAYERS = 8;
const MAX_CHAT = 100;
const MAX_NICK = 24;
const BOT_DELAY_MS = 1200;

const DEFAULT_SETTINGS: RoomSettings = {
  game: "codenames",
  botCaptains: { red: true, blue: true },
  botRisk: "normal",
  timer: { enabled: true, turnSec: 60, firstTurnSec: 120, bonusSec: 10 },
};

const DEFAULT_TIMER = { enabled: true, turnSec: 60, firstTurnSec: 120, bonusSec: 10 };

function timerOf(settings: RoomSettings) {
  return { ...DEFAULT_TIMER, ...(settings.timer ?? {}) };
}

/** Взводит таймер хода отгадывания (deadline в ms epoch) и планирует автопас. */
async function armTimer(ctx: any, roomId: any, room: Doc<"rooms">, deadline: number): Promise<void> {
  const gen = (room.timerGen ?? 0) + 1;
  await ctx.db.patch(roomId, { turnDeadline: deadline, timerGen: gen });
  await ctx.scheduler.runAfter(Math.max(0, deadline - Date.now()), internal.rooms.turnTimeout, {
    roomId,
    gen,
  });
}

/** Сбрасывает таймер (инвалидирует запланированный автопас). */
async function clearTimer(ctx: any, roomId: any, room: Doc<"rooms">): Promise<void> {
  await ctx.db.patch(roomId, { turnDeadline: null, timerGen: (room.timerGen ?? 0) + 1 });
}

/** После подсказки началась фаза отгадывания — взводим таймер, если включён. */
async function startGuessTimer(ctx: any, roomId: any, next: CodenamesState): Promise<void> {
  const room = await ctx.db.get(roomId);
  if (!room) return;
  const t = timerOf(room.settings as RoomSettings);
  if (!t.enabled) return;
  const firstTurn = next.log.filter((e: { type: string }) => e.type === "clue").length <= 1;
  const sec = firstTurn ? t.firstTurnSec : t.turnSec;
  await armTimer(ctx, roomId, room, Date.now() + sec * 1000);
}

export const turnTimeout = internalMutation({
  args: { roomId: v.id("rooms"), gen: v.number() },
  returns: v.null(),
  handler: async (ctx, { roomId, gen }) => {
    const room = await ctx.db.get(roomId);
    if (!room || (room.timerGen ?? 0) !== gen) return null;
    const game = room.game as CodenamesState | null;
    if (!game || room.phase !== "playing" || game.phase !== "guess") return null;
    await ctx.db.patch(roomId, {
      game: enginePass(game),
      turnDeadline: null,
      timerGen: gen + 1,
      updatedAt: Date.now(),
    });
    const fresh = await ctx.db.get(roomId);
    if (fresh) await maybeScheduleBot(ctx, fresh);
    return null;
  },
});

type PlayerRecord = RoomPlayer & { token: string };

function makePlayer(nickname: string): PlayerRecord {
  const nick = nickname.trim().slice(0, MAX_NICK);
  if (!nick) throw new Error("Введите ник");
  return {
    id: crypto.randomUUID(),
    token: crypto.randomUUID(),
    nickname: nick,
    team: null,
    role: "guesser",
    connected: true,
  };
}

async function getRoom(ctx: { db: any }, code: string): Promise<Doc<"rooms">> {
  const room = await ctx.db
    .query("rooms")
    .withIndex("by_code", (q: any) => q.eq("code", code.toUpperCase()))
    .unique();
  if (!room) throw new Error("Комната не найдена");
  return room;
}

function findPlayer(room: Doc<"rooms">, token: string): PlayerRecord {
  const p = (room.players as PlayerRecord[]).find((p) => p.token === token);
  if (!p) throw new Error("Игрок не найден");
  return p;
}

/** Запланировать ход бота-капитана, если сейчас фаза подсказки его команды. */
async function maybeScheduleBot(ctx: any, room: Doc<"rooms">): Promise<void> {
  const game = room.game as CodenamesState | null;
  if (!game || game.phase !== "clue") return;
  const settings = room.settings as RoomSettings;
  if (!settings.botCaptains[game.turn] || room.botPending) return;
  await ctx.db.patch(room._id, { botPending: true });
  await ctx.scheduler.runAfter(BOT_DELAY_MS, internal.rooms.botClue, { roomId: room._id });
}

export const botClue = internalMutation({
  args: { roomId: v.id("rooms") },
  returns: v.null(),
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return null;
    await ctx.db.patch(roomId, { botPending: false });
    const game = room.game as CodenamesState | null;
    const settings = room.settings as RoomSettings;
    if (!game || game.phase !== "clue" || !settings.botCaptains[game.turn]) return null;
    const trace = suggestClue(game, game.turn, settings.botRisk);
    if (!trace) return null;
    const next = engineGiveClue(game, trace.clue);
    await ctx.db.patch(roomId, { game: next, updatedAt: Date.now() });
    await startGuessTimer(ctx, roomId, next);
    return null;
  },
});

export const create = mutation({
  args: { nickname: v.string(), settings: v.any() },
  returns: v.object({ code: v.string(), playerId: v.string(), token: v.string() }),
  handler: async (ctx, { nickname, settings }) => {
    const player = makePlayer(nickname);
    let code = generateRoomCode();
    // избегаем коллизий кода
    for (let i = 0; i < 5; i++) {
      const exists = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();
      if (!exists) break;
      code = generateRoomCode();
    }
    await ctx.db.insert("rooms", {
      code,
      hostId: player.id,
      phase: "lobby",
      settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}), game: "codenames" },
      players: [player],
      chat: [],
      game: null,
      botPending: false,
      updatedAt: Date.now(),
    });
    return { code, playerId: player.id, token: player.token };
  },
});

export const join = mutation({
  args: { code: v.string(), nickname: v.string() },
  returns: v.object({ code: v.string(), playerId: v.string(), token: v.string() }),
  handler: async (ctx, { code, nickname }) => {
    const room = await getRoom(ctx, code);
    if (room.phase !== "lobby") throw new Error("Игра уже началась");
    if (room.players.length >= MAX_PLAYERS) throw new Error("Комната заполнена");
    const player = makePlayer(nickname);
    await ctx.db.patch(room._id, {
      players: [...room.players, player],
      updatedAt: Date.now(),
    });
    return { code: room.code, playerId: player.id, token: player.token };
  },
});

export const leave = mutation({
  args: { code: v.string(), token: v.string() },
  returns: v.null(),
  handler: async (ctx, { code, token }) => {
    const room = await getRoom(ctx, code);
    const player = findPlayer(room, token);
    let players = room.players as PlayerRecord[];
    if (room.phase === "lobby") players = players.filter((p) => p.id !== player.id);
    else players = players.map((p) => (p.id === player.id ? { ...p, connected: false } : p));
    const anyConnected = players.some((p) => p.connected);
    if (players.length === 0 || (room.phase !== "lobby" && !anyConnected)) {
      await ctx.db.delete(room._id);
      return null;
    }
    const hostId =
      room.hostId === player.id && players.length > 0 ? players[0]!.id : room.hostId;
    await ctx.db.patch(room._id, { players, hostId, updatedAt: Date.now() });
    return null;
  },
});

export const setTeam = mutation({
  args: { code: v.string(), token: v.string(), team: v.union(v.literal("red"), v.literal("blue")), role: v.union(v.literal("captain"), v.literal("guesser")) },
  returns: v.null(),
  handler: async (ctx, { code, token, team, role }) => {
    const room = await getRoom(ctx, code);
    if (room.phase !== "lobby") throw new Error("Состав можно менять только в лобби");
    const player = findPlayer(room, token);
    const settings = room.settings as RoomSettings;
    if (role === "captain") {
      if (settings.botCaptains[team as Team]) throw new Error("У этой команды капитан — бот");
      const taken = (room.players as PlayerRecord[]).some(
        (p) => p.id !== player.id && p.team === team && p.role === "captain",
      );
      if (taken) throw new Error("Капитан этой команды уже выбран");
    }
    const players = (room.players as PlayerRecord[]).map((p) =>
      p.id === player.id ? { ...p, team: team as Team, role: role as PlayerRole } : p,
    );
    await ctx.db.patch(room._id, { players, updatedAt: Date.now() });
    return null;
  },
});

export const updateSettings = mutation({
  args: { code: v.string(), token: v.string(), settings: v.any() },
  returns: v.null(),
  handler: async (ctx, { code, token, settings }) => {
    const room = await getRoom(ctx, code);
    const player = findPlayer(room, token);
    if (player.id !== room.hostId) throw new Error("Настройки меняет только хост");
    if (room.phase !== "lobby") throw new Error("Игра уже началась");
    const next: RoomSettings = { ...(room.settings as RoomSettings), ...settings, game: "codenames" };
    const players = (room.players as PlayerRecord[]).map((p) =>
      p.team && p.role === "captain" && next.botCaptains[p.team] ? { ...p, role: "guesser" as PlayerRole } : p,
    );
    await ctx.db.patch(room._id, { settings: next, players, updatedAt: Date.now() });
    return null;
  },
});

export const start = mutation({
  args: { code: v.string(), token: v.string() },
  returns: v.null(),
  handler: async (ctx, { code, token }) => {
    const room = await getRoom(ctx, code);
    const player = findPlayer(room, token);
    if (player.id !== room.hostId) throw new Error("Начать игру может только хост");
    if (room.phase !== "lobby") throw new Error("Игра уже началась");
    const settings = room.settings as RoomSettings;
    const players = room.players as PlayerRecord[];
    for (const team of ["red", "blue"] as Team[]) {
      const members = players.filter((p) => p.team === team);
      if (members.filter((p) => p.role === "guesser").length === 0)
        throw new Error(`У команды ${team === "red" ? "красных" : "синих"} нет отгадывающих`);
      if (!settings.botCaptains[team] && !members.some((p) => p.role === "captain"))
        throw new Error(
          `У команды ${team === "red" ? "красных" : "синих"} нет капитана (или включите бота)`,
        );
    }
    const game = createGame(pickWords(BOARD_SIZE));
    await ctx.db.patch(room._id, { game, phase: "playing", updatedAt: Date.now() });
    const fresh = await ctx.db.get(room._id);
    if (fresh) await maybeScheduleBot(ctx, fresh);
    return null;
  },
});

export const giveClue = mutation({
  args: { code: v.string(), token: v.string(), clue: v.any() },
  returns: v.null(),
  handler: async (ctx, { code, token, clue }) => {
    const room = await getRoom(ctx, code);
    const player = findPlayer(room, token);
    const game = room.game as CodenamesState | null;
    if (!game || room.phase !== "playing") throw new Error("Игра не идёт");
    if (player.team !== game.turn || player.role !== "captain")
      throw new Error("Сейчас подсказку даёт капитан другой команды");
    const next = engineGiveClue(game, clue as Clue);
    await ctx.db.patch(room._id, { game: next, updatedAt: Date.now() });
    await startGuessTimer(ctx, room._id, next);
    return null;
  },
});

export const guess = mutation({
  args: { code: v.string(), token: v.string(), cardIndex: v.number() },
  returns: v.null(),
  handler: async (ctx, { code, token, cardIndex }) => {
    const room = await getRoom(ctx, code);
    const player = findPlayer(room, token);
    const game = room.game as CodenamesState | null;
    if (!game || room.phase !== "playing") throw new Error("Игра не идёт");
    if (player.team !== game.turn || player.role !== "guesser")
      throw new Error("Сейчас отгадывает другая команда");
    const next = engineGuess(game, cardIndex);
    const patch: Record<string, unknown> = {
      game: next,
      phase: next.phase === "finished" ? "finished" : room.phase,
      updatedAt: Date.now(),
    };
    if (next.phase === "finished" && next.winner) {
      const series = (room.series as { red: number; blue: number } | undefined) ?? { red: 0, blue: 0 };
      patch.series = { ...series, [next.winner]: series[next.winner] + 1 };
    }
    await ctx.db.patch(room._id, patch);
    const fresh = await ctx.db.get(room._id);
    if (!fresh) return null;
    const t = timerOf(fresh.settings as RoomSettings);
    if (next.phase === "guess" && next.turn === game.turn) {
      // верное слово — продлеваем таймер
      if (t.enabled && fresh.turnDeadline)
        await armTimer(ctx, room._id, fresh, fresh.turnDeadline + t.bonusSec * 1000);
    } else {
      await clearTimer(ctx, room._id, fresh);
    }
    const fresh2 = await ctx.db.get(room._id);
    if (fresh2) await maybeScheduleBot(ctx, fresh2);
    return null;
  },
});

export const pass = mutation({
  args: { code: v.string(), token: v.string() },
  returns: v.null(),
  handler: async (ctx, { code, token }) => {
    const room = await getRoom(ctx, code);
    const player = findPlayer(room, token);
    const game = room.game as CodenamesState | null;
    if (!game || room.phase !== "playing") throw new Error("Игра не идёт");
    if (player.team !== game.turn || player.role !== "guesser")
      throw new Error("Сейчас ходит другая команда");
    await ctx.db.patch(room._id, { game: enginePass(game), updatedAt: Date.now() });
    const fresh = await ctx.db.get(room._id);
    if (fresh) {
      await clearTimer(ctx, room._id, fresh);
      const fresh2 = await ctx.db.get(room._id);
      if (fresh2) await maybeScheduleBot(ctx, fresh2);
    }
    return null;
  },
});

/** Новый раунд: комната возвращается в лобби, игроки и счёт серии остаются. */
export const newRound = mutation({
  args: { code: v.string(), token: v.string() },
  returns: v.null(),
  handler: async (ctx, { code, token }) => {
    const room = await getRoom(ctx, code);
    const player = findPlayer(room, token);
    if (player.id !== room.hostId) throw new Error("Новый раунд начинает хост");
    if (room.phase !== "finished") throw new Error("Игра ещё не закончена");
    await ctx.db.patch(room._id, {
      game: null,
      phase: "lobby",
      botPending: false,
      turnDeadline: null,
      timerGen: (room.timerGen ?? 0) + 1,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const sendChat = mutation({
  args: { code: v.string(), token: v.string(), text: v.string() },
  returns: v.null(),
  handler: async (ctx, { code, token, text }) => {
    const room = await getRoom(ctx, code);
    const player = findPlayer(room, token);
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed) throw new Error("Пустое сообщение");
    const msg: ChatMessage = {
      authorId: player.id,
      authorName: player.nickname,
      text: trimmed,
      sentAt: Date.now(),
    };
    const chat = [...(room.chat as ChatMessage[]), msg].slice(-MAX_CHAT);
    await ctx.db.patch(room._id, { chat, updatedAt: Date.now() });
    return null;
  },
});

/** Реактивное состояние комнаты глазами игрока (по токену). */
export const roomState = query({
  args: { code: v.string(), token: v.string() },
  returns: v.union(
    v.object({
      room: v.any(),
      game: v.union(v.any(), v.null()),
      chat: v.array(v.any()),
      playerId: v.string(),
      turnDeadline: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, { code, token }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .unique();
    if (!room) return null;
    const player = (room.players as PlayerRecord[]).find((p) => p.token === token);
    if (!player) return null;
    const game = room.game as CodenamesState | null;
    const seesKey = (player.role === "captain" && player.team !== null) || game?.phase === "finished";
    return {
      room: {
        code: room.code,
        hostId: room.hostId,
        phase: room.phase,
        settings: room.settings,
        players: (room.players as PlayerRecord[]).map(({ token: _t, ...p }) => p),
        series: (room.series as { red: number; blue: number } | undefined) ?? { red: 0, blue: 0 },
      },
      game: game ? redactCodenames(game, seesKey) : null,
      chat: room.chat,
      playerId: player.id,
      turnDeadline: room.phase === "playing" ? (room.turnDeadline ?? null) : null,
    };
  },
});
