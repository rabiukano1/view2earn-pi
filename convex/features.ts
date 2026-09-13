import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./admin";

/**
 * Returns a map of all global feature toggles.
 * Only returns platformSettings keys that start with "feature:".
 * If a key doesn't exist, the feature is assumed to be enabled by default.
 */
export const getFlags = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("platformSettings").collect();

    const flags: Record<string, boolean> = {};

    for (const setting of settings) {
      if (setting.key.startsWith("feature:")) {
        flags[setting.key] = setting.value === "true";
      }
    }

    return flags;
  },
});

/**
 * Admin: Get all per-user/per-level feature overrides.
 */
export const getFeatureToggles = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    return await ctx.db.query("featureToggles").collect();
  },
});

/**
 * Admin: Set or clear a per-user feature override.
 * If `enabled` is null, the override is removed (falls back to global).
 */
export const setFeatureToggle = mutation({
  args: {
    token: v.string(),
    userId: v.optional(v.id("users")),
    level: v.optional(v.number()),
    featureKey: v.string(),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, userId, level, featureKey, enabled }) => {
    requireAdmin(token);

    if (userId === undefined && level === undefined) {
      throw new Error("Must specify either userId or level");
    }

    // Find existing override
    const existing = await ctx.db
      .query("featureToggles")
      .withIndex("by_userId_featureKey", (q) =>
        userId
          ? q.eq("userId", userId).eq("featureKey", featureKey)
          : q.eq("level", level!).eq("featureKey", featureKey)
      )
      .unique();

    if (enabled === null || enabled === undefined) {
      // Remove the override
      if (existing) {
        await ctx.db.delete(existing._id);
      }
      return null;
    }

    if (existing) {
      await ctx.db.patch(existing._id, { enabled, updatedAt: Date.now() });
      return existing._id;
    }

    return await ctx.db.insert("featureToggles", {
      userId,
      level,
      featureKey,
      enabled,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get effective feature flags for a specific user, merging:
 * 1. Global platformSettings feature flags
 * 2. Level-based overrides
 * 3. Per-user overrides (highest priority)
 */
export const getEffectiveFlags = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, { userId }) => {
    const settings = await ctx.db.query("platformSettings").collect();

    const flags: Record<string, boolean> = {};

    for (const setting of settings) {
      if (setting.key.startsWith("feature:")) {
        flags[setting.key] = setting.value === "true";
      }
    }

    if (!userId) return flags;

    // Get user's level
    const user = await ctx.db.get(userId);
    if (!user) return flags;
    const userLevel = user.tier ?? 0;

    // Apply level-based overrides (medium priority)
    const levelOverrides = await ctx.db
      .query("featureToggles")
      .withIndex("by_level_featureKey", (q) => q.eq("level", userLevel))
      .collect();
    for (const ov of levelOverrides) {
      flags[ov.featureKey] = ov.enabled;
    }

    // Apply per-user overrides (highest priority)
    const userOverrides = await ctx.db
      .query("featureToggles")
      .withIndex("by_userId_featureKey", (q) => q.eq("userId", userId))
      .collect();
    for (const ov of userOverrides) {
      flags[ov.featureKey] = ov.enabled;
    }

    return flags;
  },
});
