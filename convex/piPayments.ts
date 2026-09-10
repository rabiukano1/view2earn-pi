import { v } from "convex/values";
import { internalAction, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./lib/guards";
import { enforceRateLimit } from "./lib/ratelimit";

// Pi Network purchase flow (plan §7.8: "Purchase: data/airtime with real Pi,
// via Pi SDK payment. Payment must be CONFIRMED before triggering VAS API").
//
// Follows Pi's official 3-phase U2A payment model:
//   Phase I   approve  — client Pi.createPayment -> onReadyForServerApproval
//                        -> startPiRedemption  -> POST /payments/{id}/approve
//   Phase II  blockchain — the user signs + submits the Pi transaction
//   Phase III complete — client onReadyForServerCompletion(paymentId, txid)
//                        -> completePiRedemption -> POST /payments/{id}/complete
//                        -> ONLY if confirmed 200 -> internal.vas.fulfill
//
// Pi refunds on /cancel, so if any server step fails before completion the user
// is never charged for an unfulfilled top-up.

const PI_PAYMENTS_URL = "https://api.minepi.com/v2/payments";

function piHeaders(): Record<string, string> {
  const key = process.env.PI_API_KEY ?? process.env.PI_API;
  if (!key) {
    console.error("[PiPay] CRITICAL ERROR: PI_API_KEY is not configured in Convex environment variables!");
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

// Data needed to verify + fulfill a Pi redemption, gathered in one query.
export const getFulfillmentData = internalQuery({
  args: { redemptionId: v.id("redemptions") },
  handler: async (ctx, { redemptionId }) => {
    const redemption = await ctx.db.get(redemptionId);
    if (!redemption) return null;
    const catalogItem = await ctx.db.get(redemption.catalogId);
    const user = await ctx.db.get(redemption.userId);
    const piUid = extractPiUid(user?.externalUid);
    return {
      redemption,
      catalogItem,
      piUid,
      expectedAmount: catalogItem?.coinPrice ?? null,
    };
  },
});

// ---- Phase I: create the redemption + approve the Pi payment ----------------

export const startPiRedemption = mutation({
  args: {
    userId: v.id("users"),
    catalogId: v.id("catalog"),
    phoneNumber: v.string(),
    paymentId: v.string(),
  },
  handler: async (ctx, { userId, catalogId, phoneNumber, paymentId }) => {
    await requireUser(ctx, userId);

    // The Pi SDK retries onReadyForServerApproval roughly every 10s with the
    // SAME paymentId when a prior attempt fails. Reuse the existing redemption
    // instead of inserting a duplicate on retry (checked before rate-limit so
    // legitimate retries are never rejected).
    const existing = await ctx.db.query("redemptions").filter((q) =>
      q.eq(q.field("paymentId"), paymentId),
    ).first();
    if (existing) return { redemptionId: existing._id };

    await enforceRateLimit(ctx, userId, "redeem");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    if (user.ecosystem !== "PI") {
      throw new Error("Pi purchases are for Pi Network accounts only");
    }
    if (!/^[0-9+\s-]{6,20}$/.test(phoneNumber.trim())) {
      throw new Error("Enter a valid phone number");
    }

    const item = await ctx.db.get(catalogId);
    if (!item || !item.enabled) throw new Error("Reward unavailable");
    if (!item.coinPrice) throw new Error("This reward is not available for Pi purchase");

    const redemptionId = await ctx.db.insert("redemptions", {
      userId,
      economy: "pi-browser",
      catalogId,
      paidWith: "PI",
      amount: item.coinPrice,
      phoneNumber: phoneNumber.trim(),
      status: "processing",
      paymentId,
    });

    // Defer the approving HTTP call (fetch is action-only).
    await ctx.scheduler.runAfter(0, internal.piPayments.approvePayment, {
      redemptionId,
    });

    return { redemptionId };
  },
});

export const approvePayment = internalAction({
  args: { redemptionId: v.id("redemptions") },
  handler: async (ctx, { redemptionId }) => {
    const data = await ctx.runQuery(internal.piPayments.getFulfillmentData, {
      redemptionId,
    });
    if (!data || !data.redemption) return;
    const { redemption, piUid, expectedAmount } = data;
    const paymentId = redemption.paymentId;
    if (!paymentId) return;

    try {
      // Never approve blindly — verify amount + ownership against Pi's servers.
      const payment = await getPayment(paymentId);
      if (payment.status?.cancelled || payment.status?.user_cancelled) {
        await ctx.runMutation(internal.rewards.refundRedemption, {
          redemptionId,
          reason: "REFUND_PI_USER_CANCELLED",
        });
        return;
      }
      const amountOk = expectedAmount === null || Math.abs(Number(payment.amount) - expectedAmount) < 0.0001;
      const payUid = payment.user_uid || payment.client?.uid;
      const uidOk = !piUid || !payUid || payUid.toLowerCase().trim() === piUid.toLowerCase().trim();
      if (!amountOk || !uidOk) {
        throw new Error(`Pi payment verification failed (amountOk: ${amountOk}, payUid: ${payUid}, expectedUid: ${piUid})`);
      }

      const approveRes = await fetch(`${PI_PAYMENTS_URL}/${paymentId}/approve`, {
        method: "POST",
        headers: piHeaders(),
      });
      if (!approveRes.ok) {
        const errText = await approveRes.text().catch(() => "");
        throw new Error(`Pi payment approval failed (HTTP ${approveRes.status}): ${errText}`);
      }
      console.log(`[PiPay] Approved payment ${paymentId} for redemption ${redemptionId}`);
    } catch (e) {
      console.error(`[PiPay] Approval failed for ${redemptionId}:`, e);
      await ctx.runMutation(internal.rewards.refundRedemption, {
        redemptionId,
        reason: `REFUND_PI_APPROVE_FAILED: ${(e as Error)?.message ?? "approval error"}`,
      });
    }
  },
});

// ---- Phase III: complete the Pi payment (confirmed) then fulfill ------------

export const completePiRedemption = mutation({
  args: {
    userId: v.id("users"),
    paymentId: v.string(),
    txid: v.string(),
  },
  handler: async (ctx, { userId, paymentId, txid }) => {
    await requireUser(ctx, userId);

    const user = await ctx.db.get(userId);
    if (!user || user.ecosystem !== "PI") {
      throw new Error("Pi purchases are for Pi Network accounts only");
    }

    const redemption = await ctx.db.query("redemptions").withIndex("by_user", (q) =>
      q.eq("userId", userId),
    ).filter((q) =>
      q.and(
        q.eq(q.field("paidWith"), "PI"),
        q.eq(q.field("paymentId"), paymentId),
      ),
    ).first();
    if (!redemption) throw new Error("No matching Pi purchase for this account");
    if (redemption.status !== "processing") {
      // SDK retries this callback on failure; a finalised purchase is a no-op.
      return { redemptionId: redemption._id };
    }

    await ctx.scheduler.runAfter(0, internal.piPayments.completeAndFulfill, {
      redemptionId: redemption._id,
      paymentId,
      txid,
    });

    return { redemptionId: redemption._id };
  },
});

export const completeAndFulfill = internalAction({
  args: {
    redemptionId: v.id("redemptions"),
    paymentId: v.string(),
    txid: v.string(),
  },
  handler: async (ctx, { redemptionId, paymentId, txid }) => {
    const data = await ctx.runQuery(internal.piPayments.getFulfillmentData, {
      redemptionId,
    });
    if (!data || !data.redemption) return;
    const { piUid, expectedAmount } = data;

    try {
      // Verify the on-chain transaction matches what Pi reports before completing.
      const payment = await getPayment(paymentId);
      if (payment.transaction?.txid && payment.transaction.txid !== txid) {
        throw new Error(`Txid mismatch (supplied ${txid}, payment ${payment.transaction.txid})`);
      }
      const amountOk = expectedAmount === null || Math.abs(Number(payment.amount) - expectedAmount) < 0.0001;
      const payUid = payment.user_uid || payment.client?.uid;
      const uidOk = !piUid || !payUid || payUid.toLowerCase().trim() === piUid.toLowerCase().trim();
      if (!amountOk || !uidOk) {
        throw new Error(`Pi payment verification failed (amountOk: ${amountOk}, payUid: ${payUid}, expectedUid: ${piUid})`);
      }

      // Phase III: confirm the payment to Pi.
      const completeRes = await fetch(`${PI_PAYMENTS_URL}/${paymentId}/complete`, {
        method: "POST",
        headers: piHeaders(),
        body: JSON.stringify({ txid }),
      });
      if (!completeRes.ok) {
        const errText = await completeRes.text().catch(() => "");
        throw new Error(`Pi payment completion failed (HTTP ${completeRes.status}): ${errText}`);
      }

      // Payment confirmed → now trigger the real airtime/data fulfillment.
      await ctx.runAction(internal.vas.fulfill, { redemptionId });
      console.log(`[PiPay] Completed payment ${paymentId} (txid ${txid}) for redemption ${redemptionId}`);
    } catch (e) {
      console.error(`[PiPay] Complete+fulfill failed for ${redemptionId}:`, e);
      // If we haven't completed yet, cancelling makes Pi refund the user.
      try {
        await fetch(`${PI_PAYMENTS_URL}/${paymentId}/cancel`, {
          method: "POST",
          headers: piHeaders(),
        });
      } catch {
        // ignore cancel errors
      }
      await ctx.runMutation(internal.rewards.refundRedemption, {
        redemptionId,
        reason: `REFUND_PI_COMPLETE_FAILED: ${(e as Error)?.message ?? "completion error"}`,
      });
    }
  },
});