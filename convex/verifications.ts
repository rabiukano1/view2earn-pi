import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { enforceRateLimit } from "./lib/ratelimit";
import { requireUser, requireAuth } from "./lib/guards";
import { isImpossibleSpeed } from "@view2earn/core";
import { recomputeUserScore } from "./fraud";
import { targetUrlsOf } from "./tasks";
import { economyOfUser } from "./lib/ledger";
import { getNum } from "./rewardsConfig";
import { awardXP } from "./xp";

// Task Verification State Machine (plan §5):
// CREATED → USER_CLAIMED_DONE → PROOF_SUBMITTED
//   → AI_APPROVED / AI_UNCERTAIN(→ADMIN_REVIEW) / AI_REJECTED(→REJECTED)
//   → PENDING_HOLD (48h) → RELEASED | CANCELLED

// TODO(prod): 48h per plan. Short hold in dev so the full flow is testable.
const HOLD_MS = 60 * 1000;
const AI_APPROVE_THRESHOLD = 0.85;
const AI_REJECT_THRESHOLD = 0.4;

// Trust-based sampling (plan §4 Stage 4): new users are 100% verified; trusted
// users are randomly sampled and otherwise auto-approved into the hold; any
// recent fraud or a high score forces 100% verification again.
const NEW_USER_TASKS = 10;      // first N completions: always verify
const SAMPLE_RATE = 0.4;        // trusted users: verify ~40% of the time
const HIGH_FRAUD_SCORE = 50;
const FRAUD_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

// Decide whether to actually run AI verification on this screenshot, or trust
// the user and auto-approve into the hold.
async function shouldVerify(ctx: any, userId: string): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (user && user.fraudScore >= HIGH_FRAUD_SCORE) return true;

  const mine = await ctx.db
    .query("verifications")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  const completions = mine.filter((v: any) => v.state === "RELEASED").length;
  if (completions < NEW_USER_TASKS) return true;

  const cutoff = Date.now() - FRAUD_LOOKBACK_MS;
  const fraud = await ctx.db
    .query("fraudEvents")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  if (fraud.some((f: any) => f._creationTime >= cutoff)) return true;

  return Math.random() < SAMPLE_RATE;
}

function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

// NOTE(dev): takes userId directly until Sidra auth lands; after auth this
// must derive the user from ctx.auth (never trust a client-sent userId).
async function checkPlatformLimit(
  ctx: any,
  userId: string,
  platform: string,
): Promise<void> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const since = todayStart.getTime();

  const mine = await ctx.db
    .query("verifications")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  const samePlatform = mine.filter((v: any) => {
    if (v.state === "CANCELLED" || v.state === "REJECTED") return false;
    if (v.platform !== platform) return false;
    return v._creationTime >= since;
  });

  const limits = await ctx.db.query("platformLimits").collect();
  const cfg = (limits as any[]).find((l: any) => l.platform === platform);
  const dailyLimit = cfg?.dailyTaskLimit ?? 50;
  const cooldownMin = cfg?.cooldownMinutes ?? 0;

  if (samePlatform.length >= dailyLimit) {
    throw new Error(`Daily ${platform} limit reached (${dailyLimit}). Try again tomorrow.`);
  }

  if (cooldownMin > 0 && samePlatform.length > 0) {
    const last = (samePlatform as any[]).sort((a: any, b: any) => b._creationTime - a._creationTime)[0];
    const elapsed = Date.now() - last._creationTime;
    const cooldownMs = cooldownMin * 60 * 1000;
    if (elapsed < cooldownMs) {
      const waitSec = Math.ceil((cooldownMs - elapsed) / 1000);
      const waitMin = Math.ceil(waitSec / 60);
      if (waitSec > 60) {
        throw new Error(`Please wait ${waitMin} min before your next ${platform} task.`);
      } else if (waitSec > 0) {
        throw new Error(`Please wait ${waitSec}s before your next ${platform} task.`);
      }
    }
  }
}

import { checkIpReputation, recordIpFraudSignal } from "./ipReputation";

export const claim = mutation({
  args: { taskId: v.id("tasks"), userId: v.id("users"), clientIp: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireUser(ctx, args.userId);
    await enforceRateLimit(ctx, args.userId, "claim");

    // IP Reputation & VPN Detection (Fraud Layer 3)
    if (args.clientIp) {
      const ipInfo = await checkIpReputation(args.clientIp);
      await recordIpFraudSignal(ctx, args.userId, ipInfo);
    }

    const task = await ctx.db.get(args.taskId);
    if (!task || task.status !== "active") {
      throw new Error("Task is not available");
    }
    const mine = await ctx.db
      .query("verifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const existing = mine.find((m) => m.taskId === args.taskId);
    if (existing && existing.state !== "REJECTED") {
      throw new Error("Task already claimed");
    }
    if (task.platform && task.platform !== "app") {
      await checkPlatformLimit(ctx, args.userId, task.platform);
    }
    return await ctx.db.insert("verifications", {
      taskId: args.taskId,
      userId: args.userId,
      platform: task.platform,
      state: "USER_CLAIMED_DONE",
    });
  },
});

// Telegram JOIN_CHANNEL verification (plan §7.3 / Tier 4): no screenshot —
// the bot confirms membership. Transitions to PROOF_SUBMITTED, then the
// telegram check (env-aware; dev-mocked) approves or rejects.
export const verifyTelegram = mutation({
  args: { verificationId: v.id("verifications") },
  handler: async (ctx, { verificationId }) => {
    const verification = await ctx.db.get(verificationId);
    if (!verification) throw new Error("Verification not found");
    await requireUser(ctx, verification.userId);
    if (
      verification.state !== "USER_CLAIMED_DONE" &&
      verification.state !== "REJECTED"
    ) {
      throw new Error(`Cannot verify from state ${verification.state}`);
    }
    // Real membership checks need the user's numeric Telegram id (from
    // Telegram sign-in or "Link Telegram" in Profile). Fail with a clear,
    // actionable message instead of letting the bot check fail closed.
    const user = await ctx.db.get(verification.userId);
    if (!user?.telegramUserId) {
      throw new Error(
        "Link your Telegram account first (Profile → Link Telegram) to verify channel joins.",
      );
    }
    await ctx.db.patch(verificationId, { state: "PROOF_SUBMITTED" });
    await ctx.scheduler.runAfter(0, internal.telegram.check, { verificationId });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const submitProof = mutation({
  args: {
    verificationId: v.id("verifications"),
    storageId: v.id("_storage"),
    additionalStorageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.verificationId);
    if (!verification) {
      throw new Error("Verification not found");
    }
    await requireUser(ctx, verification.userId);
    if (
      verification.state !== "USER_CLAIMED_DONE" &&
      verification.state !== "REJECTED"
    ) {
      throw new Error(`Cannot submit proof from state ${verification.state}`);
    }
    await enforceRateLimit(ctx, verification.userId, "upload");
    
    const task = await ctx.db.get(verification.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const isXMultiTask = task.platform === "x" && task.type === "MULTI_TASK";

    await ctx.db.patch(args.verificationId, {
      state: isXMultiTask ? "ADMIN_REVIEW" : "PROOF_SUBMITTED",
      screenshotStorageId: args.storageId,
      additionalScreenshots: args.additionalStorageIds,
    });

    if (isXMultiTask) {
      // Direct to manual review for 3-screenshot X multi-tasks. No AI, no hold.
      return;
    }

    // Layer 4 behavioral signal (plan §7.9): proof arriving bot-fast after the
    // claim is a flag, not a hard block — the raised score forces verification.
    if (isImpossibleSpeed(Date.now() - verification._creationTime)) {
      await ctx.db.insert("fraudEvents", {
        userId: verification.userId,
        type: "impossible-speed",
        detailsJson: JSON.stringify({
          verificationId: args.verificationId,
          elapsedMs: Date.now() - verification._creationTime,
        }),
      });
      await recomputeUserScore(ctx, verification.userId);
    }

    if (await shouldVerify(ctx, verification.userId)) {
      // Run AI vision (sampled = true set in applyAiResult).
      await ctx.scheduler.runAfter(0, internal.verifications.aiCheck, {
        verificationId: args.verificationId,
      });
    } else {
      // Trusted user, not sampled — auto-approve straight into the hold.
      const holdUntil = Date.now() + HOLD_MS;
      await ctx.db.patch(args.verificationId, {
        state: "PENDING_HOLD",
        sampled: false,
        holdUntil,
      });
      await ctx.scheduler.runAt(holdUntil, internal.verifications.release, {
        verificationId: args.verificationId,
      });
    }
  },
});

export const getVerificationForAi = internalQuery({
  args: { verificationId: v.id("verifications") },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.verificationId);
    if (!verification) return null;
    const task = await ctx.db.get(verification.taskId);
    let screenshotUrl: string | null = null;
    if (verification.screenshotStorageId) {
      screenshotUrl = await ctx.storage.getUrl(verification.screenshotStorageId);
    }
    return { verification, task, screenshotUrl };
  },
});

// Tier 1 screenshot check with free AI Vision models (Gemini 2.0 Flash REST API).
// If free API quota is exceeded or an error occurs, falls back to ADMIN_REVIEW queue.
export const aiCheck = internalAction({
  args: { verificationId: v.id("verifications") },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.verifications.getVerificationForAi, {
      verificationId: args.verificationId,
    });

    if (!data || !data.verification) {
      return;
    }

    const { task, screenshotUrl } = data;
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // Fallback if no API key configured in Convex env
    if (!geminiKey && !openaiKey) {
      console.log("[AI Vision] No GEMINI_API_KEY or OPENAI_API_KEY set. Falling back to dev mock auto-approval (0.92).");
      await ctx.runMutation(internal.verifications.applyAiResult, {
        verificationId: args.verificationId,
        confidence: 0.92,
      });
      return;
    }

    if (!screenshotUrl) {
      // Escalates to ADMIN_REVIEW if no image exists
      await ctx.runMutation(internal.verifications.applyAiResult, {
        verificationId: args.verificationId,
        confidence: 0.60,
      });
      return;
    }

    try {
      let confidence = 0.60;

      if (geminiKey) {
        // Fetch image content for free Gemini Vision REST API
        const imgRes = await fetch(screenshotUrl);
        const arrayBuf = await imgRes.arrayBuffer();
        const base64Image = Buffer.from(arrayBuf).toString("base64");
        const contentType = imgRes.headers.get("content-type") || "image/jpeg";

        const targetInfo = task
          ? `Target: "${task.targetUrl}" on platform "${task.platform || "social media"}"`
          : "Social task completion screenshot";
        const taskSteps = task && (task as any).steps;
        const actionHint = Array.isArray(taskSteps) && taskSteps.length > 0
          ? `The user was asked to do ALL of these: ${taskSteps
              .map((s: any) => `${s.action} ${s.label ? `(${s.label}) ` : ""}on ${s.targetUrl}`)
              .join("; ")}.`
          : "";
        const promptText = `Analyze this task completion screenshot.\n${targetInfo}\n${actionHint}\nDoes this screenshot clearly show that the user has followed, subscribed to, joined, liked, or commented on the page/account as requested?\nRespond ONLY with a raw JSON object formatted as: {"isFollowing": boolean, "targetMatch": boolean, "confidence": number}`;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
        const apiRes = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: promptText },
                  {
                    inlineData: {
                      mimeType: contentType,
                      data: base64Image,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        });

        if (apiRes.status === 429) {
          console.warn("[AI Vision] Free tier rate limit / quota exceeded (HTTP 429). Escalating to ADMIN_REVIEW.");
          confidence = 0.60;
        } else if (!apiRes.ok) {
          console.error(`[AI Vision] Gemini API error (${apiRes.status})`);
          confidence = 0.60;
        } else {
          const resJson = await apiRes.json();
          const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (responseText) {
            const parsed = JSON.parse(responseText.trim());
            if (parsed.isFollowing && parsed.targetMatch) {
              confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.95;
              if (confidence < 0.85) confidence = 0.92;
            } else {
              confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.20;
            }
          }
        }
      } else if (openaiKey) {
        const targetInfo = task ? `Target: "${task.targetUrl}" on ${task.platform}` : "Social task proof";
        const promptText = `Analyze screenshot for social follow proof. ${targetInfo}. Output JSON only: {"isFollowing": boolean, "targetMatch": boolean, "confidence": number}`;

        const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: promptText },
                  { type: "image_url", image_url: { url: screenshotUrl } },
                ],
              },
            ],
          }),
        });

        if (!apiRes.ok) {
          confidence = 0.60;
        } else {
          const resJson = await apiRes.json();
          const responseText = resJson.choices?.[0]?.message?.content;
          if (responseText) {
            const parsed = JSON.parse(responseText.trim());
            confidence = parsed.isFollowing && parsed.targetMatch ? parsed.confidence || 0.95 : 0.20;
          }
        }
      }

      await ctx.runMutation(internal.verifications.applyAiResult, {
        verificationId: args.verificationId,
        confidence,
      });
    } catch (err) {
      console.error("[AI Vision] Vision action error, sending to admin review:", err);
      await ctx.runMutation(internal.verifications.applyAiResult, {
        verificationId: args.verificationId,
        confidence: 0.60,
      });
    }
  },
});

export const applyAiResult = internalMutation({
  args: { verificationId: v.id("verifications"), confidence: v.number() },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.verificationId);
    if (!verification || verification.state !== "PROOF_SUBMITTED") {
      return;
    }
    if (args.confidence < AI_REJECT_THRESHOLD) {
      await ctx.db.patch(args.verificationId, {
        state: "REJECTED",
        sampled: true,
        aiConfidence: args.confidence,
      });
      return;
    }
    if (args.confidence < AI_APPROVE_THRESHOLD) {
      await ctx.db.patch(args.verificationId, {
        state: "ADMIN_REVIEW",
        sampled: true,
        aiConfidence: args.confidence,
      });
      return;
    }
    
    // AI Verified (>= 0.85) -> INSTANT RELEASE! (Points credited immediately, no 48h hold)
    await ctx.runMutation(internal.verifications.releaseImmediately, {
      verificationId: args.verificationId,
      confidence: args.confidence,
    });
  },
});

export const releaseImmediately = internalMutation({
  args: { verificationId: v.id("verifications"), confidence: v.number() },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.verificationId);
    if (!verification) return;
    const task = await ctx.db.get(verification.taskId);
    if (!task) return;

    // Purge physical image file from storage upon approval to save database costs
    if (verification.screenshotStorageId) {
      try {
        await ctx.storage.delete(verification.screenshotStorageId);
      } catch (e) {
        console.error("Storage purge error on releaseImmediately:", e);
      }
    }
    if (verification.additionalScreenshots) {
      for (const storageId of verification.additionalScreenshots) {
        try {
          await ctx.storage.delete(storageId);
        } catch (e) {
          console.error("Storage purge error for additional screenshot:", e);
        }
      }
    }

    await ctx.db.patch(args.verificationId, {
      state: "RELEASED",
      sampled: true,
      aiConfidence: args.confidence,
      screenshotStorageId: undefined,
      additionalScreenshots: undefined,
    });

    await ctx.runMutation(internal.points.creditHelper, {
      userId: verification.userId,
      economy: await economyOfUser(ctx, verification.userId),
      delta: task.points,
      reason: "TASK_COMPLETED",
      refId: verification.taskId,
    });

    const taskXp = task.xpReward ?? (await getNum(ctx, "taskXp")) ?? 100;
    await awardXP(ctx, {
      userId: verification.userId,
      amount: taskXp,
      source: "TASK",
      sourceId: verification.taskId,
    });

    if (task.targetUrl || (Array.isArray(task.steps) && task.steps.length > 0)) {
      for (const url of targetUrlsOf(task)) {
        await ctx.db.insert("completedTargets", {
          userId: verification.userId,
          normalizedUrl: normalizeUrl(url),
        });
      }
    }

    const listing = await ctx.db
      .query("marketplaceListings")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .filter((q) => q.eq(q.field("taskId"), verification.taskId))
      .first();
    if (listing) {
      const updated = listing.completionsSoFar + 1;
      await ctx.db.patch(listing._id, { completionsSoFar: updated });
      if (updated >= listing.maxCompletions) {
        await ctx.db.patch(listing._id, { status: "completed" });
        await ctx.db.patch(task._id, { status: "expired" });
      }
    }

    // Qualified referral check
    await ctx.runMutation(internal.referrals.checkQualification, {
      userId: verification.userId,
    });
  },
});

export const release = internalMutation({
  args: { verificationId: v.id("verifications") },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.verificationId);
    if (!verification || verification.state !== "PENDING_HOLD") {
      return;
    }
    const task = await ctx.db.get(verification.taskId);
    if (!task) {
      return;
    }

    // Purge physical image file from storage upon release to save database costs
    if (verification.screenshotStorageId) {
      try {
        await ctx.storage.delete(verification.screenshotStorageId);
      } catch (e) {
        console.error("Storage purge error on release:", e);
      }
    }
    if (verification.additionalScreenshots) {
      for (const storageId of verification.additionalScreenshots) {
        try {
          await ctx.storage.delete(storageId);
        } catch (e) {
          console.error("Storage purge error for additional screenshot on release:", e);
        }
      }
    }

    await ctx.db.patch(args.verificationId, {
      state: "RELEASED",
      screenshotStorageId: undefined,
      additionalScreenshots: undefined,
    });
    await ctx.runMutation(internal.points.creditHelper, {
      userId: verification.userId,
      economy: await economyOfUser(ctx, verification.userId),
      delta: task.points,
      reason: "TASK_COMPLETED",
      refId: verification.taskId,
    });

    const taskXp = task.xpReward ?? (await getNum(ctx, "taskXp")) ?? 100;
    await awardXP(ctx, {
      userId: verification.userId,
      amount: taskXp,
      source: "TASK",
      sourceId: verification.taskId,
    });
    if (task.targetUrl || (Array.isArray(task.steps) && task.steps.length > 0)) {
      for (const url of targetUrlsOf(task)) {
        await ctx.db.insert("completedTargets", {
          userId: verification.userId,
          normalizedUrl: normalizeUrl(url),
        });
      }
    }
    const listing = await ctx.db
      .query("marketplaceListings")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .filter((q) => q.eq(q.field("taskId"), verification.taskId))
      .first();
    if (listing) {
      const updated = listing.completionsSoFar + 1;
      await ctx.db.patch(listing._id, { completionsSoFar: updated });
      if (updated >= listing.maxCompletions) {
        await ctx.db.patch(listing._id, { status: "completed" });
        await ctx.db.patch(task._id, { status: "expired" });
      }
    }

    // Qualified referral check: if this user was referred and just crossed
    // the qualification threshold, reward both referrer and referee (§7.7).
    await ctx.runMutation(internal.referrals.checkQualification, {
      userId: verification.userId,
    });
  },
});

export const purgeOldScreenshots = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const verifications = await ctx.db
      .query("verifications")
      .withIndex("by_state", (q) => q.eq("state", "RELEASED"))
      .collect();

    for (const v of verifications) {
      if (v._creationTime < cutoff) {
        let patched = false;
        if (v.screenshotStorageId) {
          await ctx.storage.delete(v.screenshotStorageId);
          patched = true;
        }
        if (v.additionalScreenshots) {
          for (const storageId of v.additionalScreenshots) {
            await ctx.storage.delete(storageId);
          }
          patched = true;
        }
        if (patched) {
          await ctx.db.patch(v._id, { screenshotStorageId: undefined, additionalScreenshots: undefined });
        }
      }
    }
  },
});

// My verification per task, for the feed UI.
export const listMine = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireUser(ctx, args.userId);
    const mine = await ctx.db
      .query("verifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return mine.map((m) => ({
      _id: m._id,
      taskId: m.taskId,
      state: m.state,
      holdUntil: m.holdUntil,
    }));
  },
});
