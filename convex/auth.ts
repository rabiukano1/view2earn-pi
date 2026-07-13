import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

async function generateUsername(ecosystem: string, externalUid: string): Promise<string> {
  const prefix = ecosystem === "SIDRA" ? "sid" : "pi";
  const suffix = externalUid.slice(-8);
  return `${prefix}_${suffix}`;
}

export const sidraAuth = mutation({
  args: {
    sidraUid: v.string(),
    sidraToken: v.string(),
    deviceFingerprint: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_externalUid", (q) => q.eq("externalUid", args.sidraUid))
      .unique();

    if (existing) {
      return { userId: existing._id, isNew: false };
    }

    const username = await generateUsername("SIDRA", args.sidraUid);

    const userId = await ctx.db.insert("users", {
      ecosystem: "SIDRA",
      externalUid: args.sidraUid,
      username,
      tier: 0,
      fraudScore: 0,
      deviceFingerprint: args.deviceFingerprint,
      signupIp: "pending",
      country: "pending",
    });

    await ctx.scheduler.runAfter(0, internal.auth.verifySidraToken, {
      userId,
      sidraUid: args.sidraUid,
      sidraToken: args.sidraToken,
    });

    return { userId, isNew: true };
  },
});

export const verifySidraToken = internalAction({
  args: { userId: v.id("users"), sidraUid: v.string(), sidraToken: v.string() },
  handler: async (ctx, args) => {
    try {
      const response = await fetch("https://api.sidrachain.com/v1/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: args.sidraUid, token: args.sidraToken }),
      });

      if (!response.ok) {
        throw new Error("Token verification failed");
      }

      const data = await response.json() as { username?: string; country?: string };
      await ctx.runMutation(internal.auth.updateUserAfterVerification, {
        userId: args.userId,
        username: data.username,
        country: data.country,
      });
    } catch {
      await ctx.runMutation(internal.auth.updateUserAfterVerification, {
        userId: args.userId,
        username: undefined,
        country: undefined,
      });
    }
  },
});

export const updateUserAfterVerification = internalMutation({
  args: {
    userId: v.id("users"),
    username: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, any> = {};
    if (args.username) patch.username = args.username;
    if (args.country) patch.country = args.country;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.userId, patch);
    }
  },
});

export const getMe = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    return user;
  },
});
