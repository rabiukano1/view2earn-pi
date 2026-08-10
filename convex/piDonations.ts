import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./lib/guards";
import { enforceRateLimit } from "./lib/ratelimit";

// Pi Network donation payment flow for Pi Browser testing (plan §7.8 extension).
// Follows Pi's official 3-phase U2A payment model:
//   Phase I   approve  — client Pi.createPayment -> onReadyForServerApproval
//                        -> startDonation -> POST /payments/{id}/approve
//   Phase II  blockchain — the user signs + submits the Pi transaction
//   Phase III complete — client onReadyForServerCompletion(paymentId, txid)
//                        -> completeDonation -> POST /payments/{id}/complete
//                        -> ONLY if confirmed 200 -> markCompleted (+ optional bonus points)

const PI_PAYMENTS_URL = "https://api.minepi.com/v2/payments";

function piHeaders(): Record<string, string> {
  const key = process.env.PI_API_KEY ?? process.env.PI_API;
  if (!key) {
    console.error("[PiDonation] CRITICAL ERROR: PI_API_KEY is not configured in Convex environment variables!");
    throw new Error("PI_API_KEY is not configured in Convex environment variables. Please add PI_API_KEY to your Convex deployment settings.");
  }
  return { "Content-Type": "application/json", Authorization: `Key ${key}` };
}

type PiPaymentDTO = {
  identifier?: string;
  amount?: number;
  user_uid?: string;
  client?: { uid?: string };
  status?: {
    developer_approved?: boolean;
    transaction_verified?: boolean;
    developer_completed?: boolean;
    cancelled?: boolean;
    user_cancelled?: boolean;
  };
  transaction?: { txid?: string; verified?: boolean } | null;
};

function extractPiUid(externalUid?: string | null): string | null {
  if (!externalUid) return null;
  if (externalUid.startsWith("pi:")) return externalUid.slice(3);
  return externalUid;
}

async function getPayment(paymentId: string): Promise<PiPaymentDTO> {
  const res = await fetch(`${PI_PAYMENTS_URL}/${paymentId}`, { headers: piHeaders() });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Pi payment lookup failed (HTTP ${res.status}): ${errText}`);
  }
  return (await res.json()) as PiPaymentDTO;
}

// ponytail: bonus points ratio for Pi donation test calibrated to 500 pts per 1 Pi.
const DONATION_PTS_PER_PI = 500;

export const getDonationData = internalQuery({
  args: { donationId: v.id("piDonations") },
  handler: async (ctx, { donationId }) => {
    const donation = await ctx.db.get(donationId);
    if (!donation) return null;
    const user = await ctx.db.get(donation.userId);
    const piUid = extractPiUid(user?.externalUid);
    return {
      donation,
      piUid,
      expectedAmount: donation.amount,
    };
  },
});

export const markCompleted = internalMutation({
  args: {
    donationId: v.id("piDonations"),
    txid: v.string(),
  },
  handler: async (ctx, { donationId, txid }) => {
    const donation = await ctx.db.get(donationId);
    if (!donation || donation.status === "completed") return;

    await ctx.db.patch(donationId, {
      status: "completed",
      txid,
    });

    // Reward donor with bonus points
    const bonusPts = Math.round(donation.amount * DONATION_PTS_PER_PI);
    if (bonusPts > 0) {
      const user = await ctx.db.get(donation.userId);
      if (user) {
        const wallet = await ctx.db
          .query("wallets")
          .withIndex("by_user", (q) => q.eq("userId", donation.userId))
          .first();

        const currentBal = wallet?.pointsBalance ?? 0;
        const newBal = currentBal + bonusPts;

        if (wallet) {
          await ctx.db.patch(wallet._id, { pointsBalance: newBal });
        } else {
          await ctx.db.insert("wallets", {
            userId: donation.userId,
            pointsBalance: newBal,
            piproBalance: 0,
          });
        }

        await ctx.db.insert("pointsLedger", {
          userId: donation.userId,
          delta: bonusPts,
          reason: "PI_DONATION_BONUS",
          refId: donationId,
          balanceAfter: newBal,
        });
      }
    }
  },
});

export const markFailed = internalMutation({
  args: {
    donationId: v.id("piDonations"),
    reason: v.string(),
  },
  handler: async (ctx, { donationId, reason }) => {
    const donation = await ctx.db.get(donationId);
    if (!donation) return;
    await ctx.db.patch(donationId, { status: "failed" });
    console.warn(`[PiDonation] Marked failed for ${donationId}: ${reason}`);
  },
});

// ---- Phase I: create the donation + approve payment ------------------------

export const startDonation = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    memo: v.string(),
    paymentId: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, { userId, amount, memo, paymentId, displayName }) => {
    await requireUser(ctx, userId);

    const existing = await ctx.db
      .query("piDonations")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
      .first();
    if (existing) return { donationId: existing._id };

    await enforceRateLimit(ctx, userId, "redeem");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    if (user.ecosystem !== "PI") {
      throw new Error("Pi donations are for Pi Network accounts only");
    }
    if (amount <= 0) {
      throw new Error("Donation amount must be greater than 0");
    }

    const donationId = await ctx.db.insert("piDonations", {
      userId,
      amount,
      memo: memo || "View2Earn Donation",
      paymentId,
      status: "pending",
      displayName: displayName || user.username || user.name || "Anonymous Pi User",
    });

    await ctx.scheduler.runAfter(0, internal.piDonations.approveDonation, {
      donationId,
    });

    return { donationId };
  },
});

export const approveDonation = internalAction({
  args: { donationId: v.id("piDonations") },
  handler: async (ctx, { donationId }) => {
    const data = await ctx.runQuery(internal.piDonations.getDonationData, {
      donationId,
    });
    if (!data || !data.donation) return;
    const { donation, piUid, expectedAmount } = data;
    const paymentId = donation.paymentId;
    if (!paymentId) return;

    try {
      const payment = await getPayment(paymentId);
      if (payment.status?.cancelled || payment.status?.user_cancelled) {
        await ctx.runMutation(internal.piDonations.markFailed, {
          donationId,
          reason: "USER_CANCELLED",
        });
        return;
      }
      const amountOk = expectedAmount === null || Math.abs(Number(payment.amount) - expectedAmount) < 0.0001;
      const payUid = payment.user_uid || payment.client?.uid;
      const uidOk = !piUid || !payUid || payUid.toLowerCase().trim() === piUid.toLowerCase().trim();
      if (!amountOk || !uidOk) {
        throw new Error(`Pi donation verification failed (amountOk: ${amountOk}, payUid: ${payUid}, expectedUid: ${piUid})`);
      }

      const approveRes = await fetch(`${PI_PAYMENTS_URL}/${paymentId}/approve`, {
        method: "POST",
        headers: piHeaders(),
      });
      if (!approveRes.ok) {
        const errText = await approveRes.text().catch(() => "");
        throw new Error(`Pi payment approval failed (HTTP ${approveRes.status}): ${errText}`);
      }
      console.log(`[PiDonation] Approved payment ${paymentId} for donation ${donationId}`);
    } catch (e) {
      console.error(`[PiDonation] Approval failed for ${donationId}:`, e);
      await ctx.runMutation(internal.piDonations.markFailed, {
        donationId,
        reason: (e as Error)?.message ?? "approval error",
      });
    }
  },
});

// ---- Phase III: complete the Pi payment -----------------------------------

export const completeDonation = mutation({
  args: {
    userId: v.id("users"),
    paymentId: v.string(),
    txid: v.string(),
  },
  handler: async (ctx, { userId, paymentId, txid }) => {
    await requireUser(ctx, userId);

    const user = await ctx.db.get(userId);
    if (!user || user.ecosystem !== "PI") {
      throw new Error("Pi donations are for Pi Network accounts only");
    }

    const donation = await ctx.db
      .query("piDonations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("paymentId"), paymentId))
      .first();

    if (!donation) throw new Error("No matching Pi donation for this account");
    if (donation.status === "completed") {
      return { donationId: donation._id };
    }

    await ctx.scheduler.runAfter(0, internal.piDonations.completeAndRecord, {
      donationId: donation._id,
      paymentId,
      txid,
    });

    return { donationId: donation._id };
  },
});

export const completeAndRecord = internalAction({
  args: {
    donationId: v.id("piDonations"),
    paymentId: v.string(),
    txid: v.string(),
  },
  handler: async (ctx, { donationId, paymentId, txid }) => {
    const data = await ctx.runQuery(internal.piDonations.getDonationData, {
      donationId,
    });
    if (!data || !data.donation) return;
    const { piUid, expectedAmount } = data;

    try {
      const payment = await getPayment(paymentId);
      if (payment.transaction?.txid && payment.transaction.txid !== txid) {
        throw new Error(`Txid mismatch (supplied ${txid}, payment ${payment.transaction.txid})`);
      }
      const amountOk = expectedAmount === null || Math.abs(Number(payment.amount) - expectedAmount) < 0.0001;
      const payUid = payment.user_uid || payment.client?.uid;
      const uidOk = !piUid || !payUid || payUid.toLowerCase().trim() === piUid.toLowerCase().trim();
      if (!amountOk || !uidOk) {
        throw new Error(`Pi donation verification failed (amountOk: ${amountOk}, payUid: ${payUid}, expectedUid: ${piUid})`);
      }

      const completeRes = await fetch(`${PI_PAYMENTS_URL}/${paymentId}/complete`, {
        method: "POST",
        headers: piHeaders(),
        body: JSON.stringify({ txid }),
      });
      if (!completeRes.ok) {
        const errText = await completeRes.text().catch(() => "");
        throw new Error(`Pi payment completion failed (HTTP ${completeRes.status}): ${errText}`);
      }

      await ctx.runMutation(internal.piDonations.markCompleted, {
        donationId,
        txid,
      });
      console.log(`[PiDonation] Completed payment ${paymentId} (txid ${txid}) for donation ${donationId}`);
    } catch (e) {
      console.error(`[PiDonation] Complete failed for ${donationId}:`, e);
      try {
        await fetch(`${PI_PAYMENTS_URL}/${paymentId}/cancel`, {
          method: "POST",
          headers: piHeaders(),
        });
      } catch {
        // ignore cancel errors
      }
      await ctx.runMutation(internal.piDonations.markFailed, {
        donationId,
        reason: (e as Error)?.message ?? "completion error",
      });
    }
  },
});

// ---- Public Queries --------------------------------------------------------

export const listTopDonors = query({
  args: {},
  handler: async (ctx) => {
    const donations = await ctx.db
      .query("piDonations")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();

    const totals = new Map<string, { userId: string; displayName: string; totalPi: number; count: number }>();
    for (const d of donations) {
      const existing = totals.get(d.userId);
      if (existing) {
        existing.totalPi += d.amount;
        existing.count += 1;
      } else {
        totals.set(d.userId, {
          userId: d.userId,
          displayName: d.displayName || "Anonymous",
          totalPi: d.amount,
          count: 1,
        });
      }
    }

    const sorted = Array.from(totals.values()).sort((a, b) => b.totalPi - a.totalPi);
    return sorted.slice(0, 10);
  },
});

export const listMyDonations = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    return await ctx.db
      .query("piDonations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});
