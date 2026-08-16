import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAdmin } from "./admin";

export type LevelConfig = {
  level: number;
  name: string;
  xpRequired: number;
  desc: string;
  icon?: string;
  enabled: boolean;
};

// The 12 exact shipped levels. Admin edits create a row in the `levels`
// table that overrides the matching default (keyed by `level`).
export const LEVEL_DEFAULTS: LevelConfig[] = [
  { level: 1, name: "STARTER", xpRequired: 0, desc: "The user has just started their View2Earn journey.", enabled: true },
  { level: 2, name: "EXPLORER", xpRequired: 500, desc: "The user is beginning to explore View2Earn activities.", enabled: true },
  { level: 3, name: "RISING", xpRequired: 1500, desc: "The user is becoming more active and building momentum.", enabled: true },
  { level: 4, name: "ACTIVE", xpRequired: 3000, desc: "The user regularly participates in View2Earn activities.", enabled: true },
  { level: 5, name: "CONTRIBUTOR", xpRequired: 6000, desc: "The user is consistently contributing to the ecosystem.", enabled: true },
  { level: 6, name: "BUILDER", xpRequired: 10000, desc: "The user has developed strong and consistent participation.", enabled: true },
  { level: 7, name: "ELEVATED", xpRequired: 20000, desc: "The user has reached a higher level of meaningful participation.", enabled: true },
  { level: 8, name: "INFLUENCER", xpRequired: 35000, desc: "The user has significant participation and positive influence within the ecosystem.", enabled: true },
  { level: 9, name: "LEADER", xpRequired: 55000, desc: "The user demonstrates strong long-term participation and contribution.", enabled: true },
  { level: 10, name: "AMBASSADOR", xpRequired: 80000, desc: "The user represents a high level of participation and ecosystem contribution.", enabled: true },
  { level: 11, name: "ELITE", xpRequired: 120000, desc: "The user has achieved an advanced level of consistent participation.", enabled: true },
  { level: 12, name: "LUMINARY", xpRequired: 180000, desc: "The highest View2Earn progression level, representing exceptional long-term participation, learning and contribution.", enabled: true },
];

/** Public: get all enabled levels (defaults merged with any DB overrides) */
export const getLevels = query({
  args: {},
  handler: async (ctx): Promise<LevelConfig[]> => {
    const rows = await ctx.db.query("levels").collect();
    const overrides = new Map(rows.map(r => [r.level, r]));
    
    return LEVEL_DEFAULTS.map((def) => {
      const override = overrides.get(def.level);
      return override ? {
        level: override.level,
        name: override.name,
        xpRequired: override.xpRequired,
        desc: override.desc,
        icon: override.icon,
        enabled: override.enabled,
      } : def;
    }).filter((l) => l.enabled).sort((a, b) => a.level - b.level);
  },
});

/** Admin: get all levels (including disabled ones) */
export const getAdminLevels = query({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<LevelConfig[]> => {
    requireAdmin(token);
    const rows = await ctx.db.query("levels").collect();
    const overrides = new Map(rows.map(r => [r.level, r]));
    
    return LEVEL_DEFAULTS.map((def) => {
      const override = overrides.get(def.level);
      return override ? {
        level: override.level,
        name: override.name,
        xpRequired: override.xpRequired,
        desc: override.desc,
        icon: override.icon,
        enabled: override.enabled,
      } : def;
    }).sort((a, b) => a.level - b.level);
  },
});

/** Admin: update a level configuration */
export const upsertLevel = mutation({
  args: {
    token: v.string(),
    level: v.number(),
    name: v.string(),
    xpRequired: v.number(),
    desc: v.string(),
    icon: v.optional(v.string()),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.token);
    const existing = await ctx.db
      .query("levels")
      .withIndex("by_level", (q) => q.eq("level", args.level))
      .first();

    const { token, ...fields } = args;

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("levels", fields);
  },
});
