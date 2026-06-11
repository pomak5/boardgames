/** Комнаты Uno на Convex: лобби с настройками правил, боты, таймер ходов, чат. */
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { generateRoomCode } from "./engine/roomCode";
import {
  botAction,
  callUno,
  catchUno,
  chooseColor,
  choosePlayer,
  createUnoRound,
  DEFAULT_UNO_RULES,
  drawCard,
  passTurn,
  playCard,
  redactUno,
  resolveChallenge,
  timeoutAction,
  type UnoColor,
  type UnoRules,
  type UnoState,
} from "./engine/uno";

const MAX_CHAT = 100;
const MAX_NICK = 24;
const BOT_DELAY_MS = 1500;
const BOT_NAMES = [
  "Бот Котик",
  "Бот Барсук",
  "Бот Сова",
  "Бот Ёж",
  "Бот Лис",
  "Бот Енот",
  "Бот Хомяк",
  "Бот Бобр",
];

export interface UnoRoomSettings {
  game: "uno";
  rules: UnoRules;
  maxPlayers: number;
  timer: { enabled: boolean; turnSec: number };
}

const DEFAULT_SETTINGS: UnoRoomSettings = {
  game: "uno",
  rules: DEFAULT_UNO_RULES,
  maxPlayers: 10,
  timer: { enabled: true, turnSec: 30 },
};

interface UnoRoomPlayer {
  id: string;
  token: string;
  nickname: string;
  connected: boolean;
  isBot: boolean;
}

interface ChatMessage {
  authorId: string;
  authorName: string;
  text: string;
  sentAt: number;
}

function makePlayer(nickname: string, isBot = false): UnoRoomPlayer {
  const nick = nickname.trim().slice(0, MAX_NICK);
  if (!nick) throw new Error("Введите ник");
  return {
    id: crypto.randomUUID(),
    token: crypto.randomUUID(),
    nickname: nick,
    connected: true,
    isBot,
  };
}

async function getRoom(ctx: { db: any }, code: string): Promise<Doc<"rooms">> {
  const room = await ctx.db
    .query("rooms")
    .withIndex("by_code", (q: any) => q.eq("code", code.toUpperCase()))
    .unique();
  if (!room) throw new Error("Комната не найдена");
  if ((room.settings as UnoRoomSettings).game !== "uno")
    throw new Error("Это не комната Uno");
  return room;
}

function findPlayer(room: Doc<"rooms">, token: string): UnoRoomPlayer {
  const p = (room.players as UnoRoomPlayer[]).find(p => p.token === token);
  if (!p) throw new Error("Игрок не найден");
  return p;
}

function settingsOf(room: Doc<"rooms">): UnoRoomSettings {
  const s = room.settings as Partial<UnoRoomSettings>;
  return {
    game: "uno",
    rules: { ...DEFAULT_UNO_RULES, ...(s.rules ?? {}) },
    maxPlayers: s.maxPlayers ?? 10,
    timer: { ...DEFAULT_SETTINGS.timer, ...(s.timer ?? {}) },
  };
}

/** После изменения игры: финал/таймер/ход бота. */
async function afterUpdate(ctx: any, roomId: Id<"rooms">): Promise<void> {
  const room = await ctx.db.get(roomId);
  if (room?.phase !== "playing") return;
  const game = room.game as UnoState | null;
  if (!game) return;
  if (game.phase === "finished") {
    await ctx.db.patch(roomId, {
      phase: "finished",
      turnDeadline: null,
      timerGen: (room.timerGen ?? 0) + 1,
    });
    return;
  }
  if (game.phase === "roundEnd") {
    await ctx.db.patch(roomId, {
      turnDeadline: null,
      timerGen: (room.timerGen ?? 0) + 1,
    });
    return;
  }
  const current = game.players[game.turn];
  const player = (room.players as UnoRoomPlayer[]).find(
    p => p.id === current?.id,
  );
  const gen = (room.timerGen ?? 0) + 1;
  if (player?.isBot) {
    await ctx.db.patch(roomId, { turnDeadline: null, timerGen: gen });
    await ctx.scheduler.runAfter(BOT_DELAY_MS, internal.unoRooms.botTurn, {
      roomId,
      gen,
    });
    return;
  }
  const t = settingsOf(room).timer;
  if (!t.enabled) {
    await ctx.db.patch(roomId, { turnDeadline: null, timerGen: gen });
    return;
  }
  const deadline = Date.now() + t.turnSec * 1000;
  await ctx.db.patch(roomId, { turnDeadline: deadline, timerGen: gen });
  await ctx.scheduler.runAfter(
    t.turnSec * 1000,
    internal.unoRooms.turnTimeout,
    { roomId, gen },
  );
}

export const botTurn = internalMutation({
  args: { roomId: v.id("rooms"), gen: v.number() },
  returns: v.null(),
  handler: async (ctx, { roomId, gen }) => {
    const room = await ctx.db.get(roomId);
    if (!room || (room.timerGen ?? 0) !== gen || room.phase !== "playing")
      return null;
    const game = room.game as UnoState | null;
    if (!game || game.phase === "finished" || game.phase === "roundEnd")
      return null;
    const current = game.players[game.turn];
    const player = (room.players as UnoRoomPlayer[]).find(
      p => p.id === current?.id,
    );
    if (!player?.isBot) return null;
    const next = botAction(game);
    await ctx.db.patch(roomId, { game: next, updatedAt: Date.now() });
    await afterUpdate(ctx, roomId);
    return null;
  },
});

export const turnTimeout = internalMutation({
  args: { roomId: v.id("rooms"), gen: v.number() },
  returns: v.null(),
  handler: async (ctx, { roomId, gen }) => {
    const room = await ctx.db.get(roomId);
    if (!room || (room.timerGen ?? 0) !== gen || room.phase !== "playing")
      return null;
    const game = room.game as UnoState | null;
    if (!game || game.phase === "finished" || game.phase === "roundEnd")
      return null;
    const next = timeoutAction(game);
    await ctx.db.patch(roomId, { game: next, updatedAt: Date.now() });
    await afterUpdate(ctx, roomId);
    return null;
  },
});

export const create = mutation({
  args: { nickname: v.string(), settings: v.any() },
  returns: v.object({
    code: v.string(),
    playerId: v.string(),
    token: v.string(),
  }),
  handler: async (ctx, { nickname, settings }) => {
    const player = makePlayer(nickname);
    let code = generateRoomCode();
    for (let i = 0; i < 5; i++) {
      const exists = await ctx.db
        .query("rooms")
        .withIndex("by_code", q => q.eq("code", code))
        .unique();
      if (!exists) break;
      code = generateRoomCode();
    }
    const base = settings ?? {};
    await ctx.db.insert("rooms", {
      code,
      hostId: player.id,
      phase: "lobby",
      settings: {
        ...DEFAULT_SETTINGS,
        ...base,
        rules: { ...DEFAULT_UNO_RULES, ...(base.rules ?? {}) },
        game: "uno",
      },
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
  returns: v.object({
    code: v.string(),
    playerId: v.string(),
    token: v.string(),
  }),
  handler: async (ctx, { code, nickname }) => {
    const room = await getRoom(ctx, code);
    if (room.phase !== "lobby") throw new Error("Игра уже началась");
    if (room.players.length >= settingsOf(room).maxPlayers)
      throw new Error("Комната заполнена");
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
    let players = room.players as UnoRoomPlayer[];
    if (room.phase === "lobby")
      players = players.filter(p => p.id !== player.id);
    else
      players = players.map(p =>
        p.id === player.id ? { ...p, connected: false } : p,
      );
    const humansLeft = players.filter(p => !p.isBot);
    if (
      humansLeft.length === 0 ||
      (room.phase !== "lobby" && !humansLeft.some(p => p.connected))
    ) {
      await ctx.db.delete(room._id);
      return null;
    }
    const hostId =
      room.hostId === player.id
        ? (humansLeft[0] as UnoRoomPlayer).id
        : room.hostId;
    await ctx.db.patch(room._id, { players, hostId, updatedAt: Date.now() });
    return null;
  },
});

export const addBot = mutation({
  args: { code: v.string(), token: v.string() },
  returns: v.null(),
  handler: async (ctx, { code, token }) => {
    const room = await getRoom(ctx, code);
    if (findPlayer(room, token).id !== room.hostId)
      throw new Error("Ботов добавляет хост");
    if (room.phase !== "lobby") throw new Error("Игра уже началась");
    const players = room.players as UnoRoomPlayer[];
    if (players.length >= settingsOf(room).maxPlayers)
      throw new Error("Комната заполнена");
    const used = new Set(players.map(p => p.nickname));
    const name = BOT_NAMES.find(n => !used.has(n)) ?? `Бот №${players.length}`;
    await ctx.db.patch(room._id, {
      players: [...players, makePlayer(name, true)],
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const removeBot = mutation({
  args: { code: v.string(), token: v.string(), botId: v.string() },
  returns: v.null(),
  handler: async (ctx, { code, token, botId }) => {
    const room = await getRoom(ctx, code);
    if (findPlayer(room, token).id !== room.hostId)
      throw new Error("Ботов убирает хост");
    if (room.phase !== "lobby") throw new Error("Игра уже началась");
    const players = (room.players as UnoRoomPlayer[]).filter(
      p => !(p.isBot && p.id === botId),
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
    if (findPlayer(room, token).id !== room.hostId)
      throw new Error("Настройки меняет только хост");
    if (room.phase !== "lobby") throw new Error("Игра уже началась");
    const prev = settingsOf(room);
    const next: UnoRoomSettings = {
      game: "uno",
      rules: { ...prev.rules, ...(settings.rules ?? {}) },
      maxPlayers: Math.min(
        10,
        Math.max(2, settings.maxPlayers ?? prev.maxPlayers),
      ),
      timer: { ...prev.timer, ...(settings.timer ?? {}) },
    };
    next.rules.startingCards = Math.min(
      10,
      Math.max(5, next.rules.startingCards),
    );
    next.rules.unoPenalty = Math.min(4, Math.max(1, next.rules.unoPenalty));
    await ctx.db.patch(room._id, { settings: next, updatedAt: Date.now() });
    return null;
  },
});

export const start = mutation({
  args: { code: v.string(), token: v.string() },
  returns: v.null(),
  handler: async (ctx, { code, token }) => {
    const room = await getRoom(ctx, code);
    if (findPlayer(room, token).id !== room.hostId)
      throw new Error("Начать игру может только хост");
    if (room.phase !== "lobby") throw new Error("Игра уже началась");
    const players = room.players as UnoRoomPlayer[];
    if (players.length < 2)
      throw new Error("Нужно минимум 2 игрока (добавьте бота)");
    const game = createUnoRound(
      players.map(p => p.id),
      settingsOf(room).rules,
      {},
      Math.floor(Math.random() * players.length),
    );
    await ctx.db.patch(room._id, {
      game,
      phase: "playing",
      updatedAt: Date.now(),
    });
    await afterUpdate(ctx, room._id);
    return null;
  },
});

/** Следующий раунд при игре на очки. */
export const nextRound = mutation({
  args: { code: v.string(), token: v.string() },
  returns: v.null(),
  handler: async (ctx, { code, token }) => {
    const room = await getRoom(ctx, code);
    if (findPlayer(room, token).id !== room.hostId)
      throw new Error("Раунд начинает хост");
    const game = room.game as UnoState | null;
    if (game?.phase !== "roundEnd") throw new Error("Раунд ещё не закончен");
    const scores: Record<string, number> = {};
    for (const p of game.players) scores[p.id] = p.score;
    const winnerIdx = game.players.findIndex(p => p.id === game.roundWinner);
    const next = createUnoRound(
      game.players.map(p => p.id),
      settingsOf(room).rules,
      scores,
      (winnerIdx + 1) % game.players.length,
    );
    await ctx.db.patch(room._id, { game: next, updatedAt: Date.now() });
    await afterUpdate(ctx, room._id);
    return null;
  },
});

/** Возврат в лобби после конца матча. */
export const newGame = mutation({
  args: { code: v.string(), token: v.string() },
  returns: v.null(),
  handler: async (ctx, { code, token }) => {
    const room = await getRoom(ctx, code);
    if (findPlayer(room, token).id !== room.hostId)
      throw new Error("Новую игру начинает хост");
    if (room.phase !== "finished") throw new Error("Игра ещё не закончена");
    await ctx.db.patch(room._id, {
      game: null,
      phase: "lobby",
      turnDeadline: null,
      timerGen: (room.timerGen ?? 0) + 1,
      updatedAt: Date.now(),
    });
    return null;
  },
});

const actionValidator = v.union(
  v.object({
    type: v.literal("play"),
    cardId: v.number(),
    declareUno: v.optional(v.boolean()),
  }),
  v.object({ type: v.literal("draw") }),
  v.object({ type: v.literal("pass") }),
  v.object({
    type: v.literal("chooseColor"),
    color: v.union(
      v.literal("red"),
      v.literal("yellow"),
      v.literal("green"),
      v.literal("blue"),
    ),
  }),
  v.object({ type: v.literal("choosePlayer"), targetId: v.string() }),
  v.object({ type: v.literal("challenge"), accept: v.boolean() }),
  v.object({ type: v.literal("uno") }),
  v.object({ type: v.literal("catch") }),
);

export const act = mutation({
  args: { code: v.string(), token: v.string(), action: actionValidator },
  returns: v.null(),
  handler: async (ctx, { code, token, action }) => {
    const room = await getRoom(ctx, code);
    const player = findPlayer(room, token);
    const game = room.game as UnoState | null;
    if (!game || room.phase !== "playing") throw new Error("Игра не идёт");
    let next: UnoState;
    switch (action.type) {
      case "play":
        next = playCard(
          game,
          player.id,
          action.cardId,
          action.declareUno ?? false,
        );
        break;
      case "draw":
        next = drawCard(game, player.id);
        break;
      case "pass":
        next = passTurn(game, player.id);
        break;
      case "chooseColor":
        next = chooseColor(game, player.id, action.color as UnoColor);
        break;
      case "choosePlayer":
        next = choosePlayer(game, player.id, action.targetId);
        break;
      case "challenge":
        next = resolveChallenge(game, player.id, action.accept);
        break;
      case "uno":
        next = callUno(game, player.id);
        break;
      case "catch":
        next = catchUno(game, player.id);
        break;
    }
    await ctx.db.patch(room._id, { game: next, updatedAt: Date.now() });
    // «UNO!» и поимка не трогают очередь — таймер не перезапускаем
    if (action.type !== "uno" && action.type !== "catch")
      await afterUpdate(ctx, room._id);
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

/** Реактивное состояние комнаты глазами игрока. */
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
      .withIndex("by_code", q => q.eq("code", code.toUpperCase()))
      .unique();
    if (!room || (room.settings as UnoRoomSettings).game !== "uno") return null;
    const player = (room.players as UnoRoomPlayer[]).find(
      p => p.token === token,
    );
    if (!player) return null;
    const game = room.game as UnoState | null;
    return {
      room: {
        code: room.code,
        hostId: room.hostId,
        phase: room.phase,
        settings: settingsOf(room),
        players: (room.players as UnoRoomPlayer[]).map(
          ({ token: _t, ...p }) => p,
        ),
      },
      game: game ? redactUno(game, player.id) : null,
      chat: room.chat,
      playerId: player.id,
      turnDeadline:
        room.phase === "playing" ? (room.turnDeadline ?? null) : null,
    };
  },
});
