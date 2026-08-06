"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Internal action to process the Pi A2U payment via Pi Platform API.
// Runs in the Node.js runtime because pi-backend -> stellar-sdk -> eventsource
// depend on Node built-in modules (http, https, url, events, util).
export const processA2UPayout = internalAction({
  args: { withdrawalId: v.id("piWithdrawals") },
  handler: async (ctx, { withdrawalId }) => {
    const withdrawal = await ctx.runQuery(internal.piWithdrawals.getWithdrawalByIdInternal, {
      withdrawalId,
    });
    if (!withdrawal || withdrawal.status !== "processing") return;

    const apiKey = process.env.PI_API_KEY;
    const privateSeed = process.env.PI_WALLET_PRIVATE_SEED;

    // Extract Pi external UID (remove "pi:" prefix)
    const user = await ctx.runQuery(internal.piWithdrawals.getUserByIdInternal, {
      userId: withdrawal.userId,
    });
    const piUid = user?.externalUid?.startsWith("pi:")
      ? user.externalUid.slice(3)
      : null;

    if (!piUid) {
      await failAndRefund(ctx, withdrawal, "Missing Pi UID for account");
      return;
    }

    // Check if live private seed is available; if not, run in dev simulation mode
    if (!apiKey || !privateSeed) {
      console.log(`[PiWithdrawal] PI_WALLET_PRIVATE_SEED or PI_API_KEY not configured. Running simulation for withdrawal ${withdrawalId}`);
      // Simulate successful transaction for sandbox/development mode
      const mockTxid = `mock_tx_${Date.now()}_${withdrawalId.slice(-6)}`;
      const mockPaymentId = `mock_pay_${Date.now()}`;

      await ctx.runMutation(internal.piWithdrawals.updateWithdrawalStatus, {
        withdrawalId,
        status: "completed",
        paymentId: mockPaymentId,
        txid: mockTxid,
      });
      return;
    }

    try {
      // Dynamic import of pi-backend SDK
      const PiNetwork = require("pi-backend");
      const pi = new PiNetwork(apiKey, privateSeed);

      // Phase 1: Create A2U Payment
      const paymentData = {
        amount: withdrawal.piAmount,
        memo: `View2Earn Points Cashout (${withdrawal.pointsSpent} pts)`,
        metadata: { withdrawalId, userId: withdrawal.userId },
        uid: piUid,
      };

      const paymentId = await pi.createPayment(paymentData);
      await ctx.runMutation(internal.piWithdrawals.updateWithdrawalStatus, {
        withdrawalId,
        status: "processing",
        paymentId,
      });

      // Phase 2: Submit Payment to Blockchain
      const txid = await pi.submitPayment(paymentId);
      await ctx.runMutation(internal.piWithdrawals.updateWithdrawalStatus, {
        withdrawalId,
        status: "processing",
        paymentId,
        txid,
      });

      // Phase 3: Complete Payment
      await pi.completePayment(paymentId, txid);
      await ctx.runMutation(internal.piWithdrawals.updateWithdrawalStatus, {
        withdrawalId,
        status: "completed",
        paymentId,
        txid,
      });
      console.log(`[PiWithdrawal] Successfully processed A2U withdrawal ${withdrawalId} (txid ${txid})`);
    } catch (err) {
      const errMsg = (err as Error)?.message ?? String(err);
      console.error(`[PiWithdrawal] A2U payout failed for ${withdrawalId}:`, errMsg);
      await failAndRefund(ctx, withdrawal, errMsg);
    }
  },
});

async function failAndRefund(
  ctx: any,
  withdrawal: { _id: any; userId: any; pointsSpent: number },
  reason: string,
) {
  // Mark as failed
  await ctx.runMutation(internal.piWithdrawals.updateWithdrawalStatus, {
    withdrawalId: withdrawal._id,
    status: "failed",
    failureReason: reason,
  });

  // Refund points to user
  await ctx.runMutation(internal.points.creditHelper, {
    userId: withdrawal.userId,
    delta: withdrawal.pointsSpent,
    reason: `REFUND_PI_WITHDRAWAL_FAILED: ${reason}`,
  });
}
