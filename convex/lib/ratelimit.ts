import type { MutationCtx } from "../_generated/server";

// Sliding-window rate limits (plan §7.9 Layer 5). Burst guards on the actions
// a farmer would hammer; the per-platform daily caps + 48h hold handle the
// slower fraud vectors.
type Rule = { max: number; windowMs: number };

const RULES: Record<string, Rule> = {
  claim: { max: 12, windowMs: 60_000 },       // 12 claims / minute
  upload: { max: 10, windowMs: 60_000 },      // 10 screenshot uploads / minute
  quiz: { max: 5, windowMs: 60_000 },         // 5 quiz submits / minute
  redeem: { max: 5, windowMs: 5 * 60_000 },   // 5 redemptions / 5 minutes
  withdraw: { max: 3, windowMs: 24 * 60 * 60_000 }, // 3 Pi withdrawals / 24 hours
};

export async function enforceRateLimit(
  ctx: MutationCtx,
  userId: string,
  action: keyof typeof RULES,
): Promise<void> {
  const rule = RULES[action];
  if (!rule) return;

  const now = Date.now();
  const cutoff = now - rule.windowMs;
  const rows = await ctx.db
    .query("rateLimits")
    .withIndex("by_user_action", (q) =>
      q.eq("userId", userId as any).eq("action", action),
    )
    .collect();

  const inWindow = rows.filter((r) => r.at >= cutoff);
  if (inWindow.length >= rule.max) {
    const oldest = Math.min(...inWindow.map((r) => r.at));
    const wait = Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000));
    throw new Error(`Slow down — too many attempts. Try again in ${wait}s.`);
  }

  // Prune stale rows for this key, then record this attempt.
  for (const r of rows) {
    if (r.at < cutoff) await ctx.db.delete(r._id);
  }
  await ctx.db.insert("rateLimits", { userId: userId as any, action, at: now });
}
