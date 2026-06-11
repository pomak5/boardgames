import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,
  rooms: defineTable({
    code: v.string(),
    hostId: v.string(),
    phase: v.union(v.literal("lobby"), v.literal("playing"), v.literal("finished")),
    settings: v.any(),
    players: v.array(v.any()), // RoomPlayer + token
    chat: v.array(v.any()),
    game: v.union(v.any(), v.null()),
    botPending: v.boolean(),
    series: v.optional(v.any()),
    turnDeadline: v.optional(v.union(v.number(), v.null())),
    timerGen: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_code", ["code"]),
});

export default schema;
