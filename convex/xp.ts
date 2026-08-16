import { v } from "convex/values";
import { MutationCtx, QueryCtx, query } from "./_generated/server";
import { LEVEL_DEFAULTS } from "./levels";
import { Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/guards";

export async function awardXP(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    amount: number;
    source: string;
    sourceId?: string;
  }
) {
    // 1. Idempotency check: if sourceId is provided, prevent duplicate XP grants
    if (args.sourceId) {
      const existing = await ctx.db
        .query("xpTransactions")
        .withIndex("by_user_source", (q) =>
          q
            .eq("userId", args.userId)
            .eq("source", args.source)
            .eq("sourceId", args.sourceId)
        )
        .first();

      if (existing) {
        return; // Already awarded XP for this specific action
      }
    }

    // 2. Record the transaction
    await ctx.db.insert("xpTransactions", {
      userId: args.userId,
      amount: args.amount,
      source: args.source,
      sourceId: args.sourceId,
      createdAt: Date.now(),
    });

    // 3. Update user's total XP
    const user = await ctx.db.get(args.userId);
    if (!user) return;

    const newXp = (user.xp ?? 0) + args.amount;
    await ctx.db.patch(args.userId, { xp: newXp });

    return newXp;
}

async function calculateUserLevelProgress(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) return null;

  const xp = user.xp ?? 0;
  
  // Fetch levels, allowing DB overrides
  const rows = await ctx.db.query("levels").collect();
  const overrides = new Map(rows.map(r => [r.level, r]));
  
  const levels = LEVEL_DEFAULTS.map((def) => {
    const override = overrides.get(def.level);
    return override ? { ...def, ...override } : def;
  }).sort((a, b) => a.level - b.level);

  // Find the current level (the highest level where xp >= xpRequired)
  let currentLevel = levels[0];
  let nextLevel = levels[1] ?? null;

  for (let i = 0; i < levels.length; i++) {
    if (xp >= levels[i].xpRequired) {
      currentLevel = levels[i];
      nextLevel = levels[i + 1] ?? null;
    } else {
      break;
    }
  }

  // Calculate progress
  let progressPercentage = 100;
  let xpToNextLevel = 0;
  
  if (nextLevel) {
    const xpInCurrentLevel = xp - currentLevel.xpRequired;
    const xpNeededForNext = nextLevel.xpRequired - currentLevel.xpRequired;
    progressPercentage = Math.min(100, Math.max(0, (xpInCurrentLevel / xpNeededForNext) * 100));
    xpToNextLevel = nextLevel.xpRequired - xp;
  }

  return {
    xp,
    currentLevel,
    nextLevel,
    progressPercentage,
    xpToNextLevel,
  };
}

export const getUserLevelProgress = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await calculateUserLevelProgress(ctx, args.userId);
  },
});

export const myLevelProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = (await requireAuth(ctx)) as Id<"users">;
    return await calculateUserLevelProgress(ctx, userId);
  },
});
