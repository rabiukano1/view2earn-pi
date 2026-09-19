import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { cashOutStatus } from "./identity";
import { appendLedger, lastBalance } from "./lib/ledger";
import { getNum } from "./rewardsConfig";
import { attachTelegram } from "./telegramAuth";

// One runnable check for the 3-in-1 identity logic. Run against the LOCAL
// deployment only:  npx convex run selfcheck:identity
// Creates a throw-away user, exercises ledgers/levels/linking/gate, cleans up.
export const identity = internalMutation({
  args: {},
  handler: async (ctx: MutationCtx) => {
    const userId = await ctx.db.insert("users", {
      ecosystem: "SIDRA", externalUid: `auth:selfcheck-${Date.now()}`, username: "selfcheck",
      tier: 0, fraudScore: 0, deviceFingerprint: "test", signupIp: "0.0.0.0", country: "test",
    });
    const log: string[] = [];
    const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error("FAIL: " + msg); log.push("ok: " + msg); };

    // 1. session._creationTime === Date.now() inside one mutation (surface binding relies on it)
    const sid = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 60_000 });
    const session = await ctx.db.get(sid);
    assert(session && Math.abs(session._creationTime - Date.now()) <= 1500, "session _creationTime matches mutation clock");

    // 2. three independent ledgers
    await appendLedger(ctx, userId, "android", 100, "TEST");
    await appendLedger(ctx, userId, "telegram", 700, "TEST");
    await appendLedger(ctx, userId, "pi-browser", 1600, "TEST");
    let s = await cashOutStatus(ctx, userId);
    assert(s.linked.android === false && s.linked.telegram === false && s.linked["pi-browser"] === false, "nothing linked yet");
    assert(s.levels.android === 1 && s.levels.telegram === 2 && s.levels["pi-browser"] === 3, `per-surface levels from lifetime earned (${JSON.stringify(s.levels)})`);
    assert(Object.values(s.eligible).every((e) => !e), "gate closed on every surface");

    // 3. link all three surfaces
    await ctx.db.insert("authAccounts", { userId, provider: "password", providerAccountId: "selfcheck@test" });
    await ctx.db.insert("authAccounts", { userId, provider: "telegram", providerAccountId: "telegram:1" });
    await ctx.db.insert("authAccounts", { userId, provider: "pi", providerAccountId: "pi:1" });
    s = await cashOutStatus(ctx, userId);
    assert(s.linked.android && s.linked.telegram && s.linked["pi-browser"], "all three linked via authAccounts");
    assert(Object.values(s.reasons).every((r) => r?.startsWith("Reach level")), "gate closed: levels only");

    // 4. reach the minimum level everywhere → gate opens
    const min = await getNum(ctx, "withdrawMinLevel");
    // Per-surface: lifting only android must open android and nothing else.
    await appendLedger(ctx, userId, "android", 200_000, "TEST");
    s = await cashOutStatus(ctx, userId);
    assert(s.eligible.android && !s.eligible.telegram && !s.eligible["pi-browser"], `android alone opens at level >= ${min}`);
    for (const e of ["telegram", "pi-browser"] as const) await appendLedger(ctx, userId, e, 200_000, "TEST");
    s = await cashOutStatus(ctx, userId);
    assert(Object.values(s.eligible).every(Boolean) && Object.values(s.levels).every((l) => l >= min), `gate open at level >= ${min} on all surfaces`);

    // 5. one user <-> one Telegram account
    const other = await ctx.db.insert("users", {
      ecosystem: "SIDRA", externalUid: `auth:selfcheck2-${Date.now()}`, username: "selfcheck2",
      tier: 0, fraudScore: 0, deviceFingerprint: "test", signupIp: "0.0.0.0", country: "test",
    });
    const tgId = `sc-${Date.now()}`;
    await attachTelegram(ctx, userId, tgId);
    const acct = await ctx.db.query("authAccounts")
      .withIndex("providerAndAccountId", (q) => q.eq("provider", "telegram").eq("providerAccountId", `telegram:${tgId}`)).first();
    assert(acct?.userId === userId, "attachTelegram creates the telegram auth account");
    let threw = false;
    try { await attachTelegram(ctx, other, tgId); } catch { threw = true; }
    assert(threw, "second user cannot take an already-linked Telegram id");
    threw = false;
    try { await attachTelegram(ctx, userId, `${tgId}-b`); } catch { threw = true; }
    assert(threw, "a user cannot link a second Telegram id");
    await ctx.db.delete(other);

    // 6. Telegram-only account (Mini App first) is merged into the linking user
    const tgOnly = await ctx.db.insert("users", {
      ecosystem: "SIDRA", externalUid: `telegram:sc-only-${Date.now()}`, username: "tgonly", telegramUserId: `sc-only-${Date.now()}`,
      tier: 0, fraudScore: 0, deviceFingerprint: "test", signupIp: "0.0.0.0", country: "test",
    });
    const tgOnlyDoc = (await ctx.db.get(tgOnly))!;
    await ctx.db.insert("authAccounts", { userId: tgOnly, provider: "telegram", providerAccountId: `telegram:${tgOnlyDoc.telegramUserId}` });
    await appendLedger(ctx, tgOnly, "telegram", 300, "TEST");
    const target = await ctx.db.insert("users", {
      ecosystem: "SIDRA", externalUid: `auth:selfcheck3-${Date.now()}`, username: "selfcheck3",
      tier: 0, fraudScore: 0, deviceFingerprint: "test", signupIp: "0.0.0.0", country: "test",
    });
    await ctx.db.insert("authAccounts", { userId: target, provider: "password", providerAccountId: "sc3@test" });
    await attachTelegram(ctx, target, tgOnlyDoc.telegramUserId!);
    const merged = (await ctx.db.get(tgOnly))!;
    const tgAcct = await ctx.db.query("authAccounts")
      .withIndex("providerAndAccountId", (q) => q.eq("provider", "telegram").eq("providerAccountId", `telegram:${tgOnlyDoc.telegramUserId}`)).first();
    const movedBal = await lastBalance(ctx, target, "telegram");
    assert(merged.accountStatus === "merged" && tgAcct?.userId === target && movedBal === 300,
      "Telegram-only account merged: auth account re-pointed, telegram balance moved");
    for (const r of await ctx.db.query("pointsLedger").withIndex("by_user", (q) => q.eq("userId", target)).collect()) await ctx.db.delete(r._id);
    for (const r of await ctx.db.query("authAccounts").withIndex("userIdAndProvider", (q) => q.eq("userId", target)).collect()) await ctx.db.delete(r._id);
    await ctx.db.delete(target); await ctx.db.delete(tgOnly);

    // cleanup
    for (const t of ["pointsLedger"] as const) {
      for (const r of await ctx.db.query(t).withIndex("by_user", (q) => q.eq("userId", userId)).collect()) await ctx.db.delete(r._id);
    }
    for (const r of await ctx.db.query("authAccounts").withIndex("userIdAndProvider", (q) => q.eq("userId", userId)).collect()) await ctx.db.delete(r._id);
    await ctx.db.delete(sid);
    await ctx.db.delete(userId);
    return log;
  },
});
