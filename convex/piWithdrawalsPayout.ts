"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Internal action to process Pi A2U (App-to-User) payments via the official
// pi-backend SDK (Pi Network API + Stellar Horizon). Runs in the Node.js
// runtime because pi-backend -> stellar-sdk -> eventsource depend on Node
// built-in modules (http, https, url, events, util).
//
// Pi allows only ONE A2U payment in flight at a time (all A2U payments use the
// developer wallet's sequence number). Every withdrawal therefore flows through
// a single serialized slot guarded by a mutex row in `payoutLocks`:
//
//   acquireA2USlot  — atomically takes the slot (reclaiming stale locks) and
//                     claims the oldest queued withdrawal.
//   releaseA2USlot  — frees the slot so the next queued withdrawal can run.
//
// The worker also resumes interrupted payments from the persisted paymentId /
// txid instead of creating a duplicate payment, and verifies Pi's own
// transaction_verified + developer_completed flags before crediting the user.

const BUSY_RETRY_MS = 30 * 1000; // poll interval while another payout runs

export const processA2UPayout = internalAction({
  args: {},
  handler: async (ctx) => {
    const slot = await ctx.runMutation(internal.piWithdrawals.acquireA2USlot, {});

    if (!slot.acquired) {
      // Slot busy -> another payout is in flight; poll again later. Queue empty
      // -> nothing left to do; the drain chain terminates here.
      if (slot.busy) {
        await ctx.scheduler.runAfter(BUSY_RETRY_MS, internal.piWithdrawalsPayout.processA2UPayout, {});
      }
      return;
    }

    const withdrawalId = slot.withdrawalId;

    try {
      const withdrawal = await ctx.runQuery(internal.piWithdrawals.getWithdrawalByIdInternal, {
        withdrawalId,
      });
      if (!withdrawal || withdrawal.status !== "processing") return;

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

      const apiKey = process.env.PI_API_KEY ?? process.env.PI_API;
      const privateSeed = process.env.PI_WALLET_PRIVATE_SEED;

      // Dev/sandbox simulation when no live wallet is configured.
      if (!apiKey || !privateSeed) {
        console.log(`[PiWithdrawal] PI_WALLET_PRIVATE_SEED or PI_API_KEY not configured. Running simulation for withdrawal ${withdrawalId}`);
        await ctx.runMutation(internal.piWithdrawals.updateWithdrawalStatus, {
          withdrawalId,
          status: "completed",
          paymentId: `mock_pay_${Date.now()}`,
          txid: `mock_tx_${Date.now()}_${withdrawalId.slice(-6)}`,
        });
        return;
      }

      const PiNetwork = require("pi-backend");
      const pi = new PiNetwork(apiKey, privateSeed);

      // ---- Resume vs. create (never duplicate a payment) ---------------------
      let paymentId = withdrawal.paymentId;
      if (!paymentId) {
        // Reconcile leftover incomplete server payments (from crashed runs).
        // They block all new A2U payments, so cancel any orphans first.
        try {
          const incomplete = await pi.getIncompleteServerPayments();
          for (const orphan of incomplete) {
            try {
              await pi.cancelPayment(orphan.identifier);
              console.log(`[PiWithdrawal] Cancelled orphaned incomplete payment ${orphan.identifier}`);
            } catch {
              // best-effort cleanup
            }
          }
        } catch (e) {
          console.warn(`[PiWithdrawal] getIncompleteServerPayments failed: ${(e as Error)?.message}`);
        }

        const paymentData = {
          amount: withdrawal.piAmount,
          memo: `View2Earn Points Cashout (${withdrawal.pointsSpent} pts)`,
          metadata: { withdrawalId, userId: withdrawal.userId },
          uid: piUid,
        };
        paymentId = await pi.createPayment(paymentData);
        await ctx.runMutation(internal.piWithdrawals.updateWithdrawalStatus, {
          withdrawalId,
          status: "processing",
          paymentId,
        });
      }

      // ---- Submit to the blockchain (resume if already submitted) ------------
      let txid = withdrawal.txid;
      if (!txid) {
        try {
          txid = await pi.submitPayment(paymentId);
        } catch (e) {
          // The SDK throws "This payment already has a linked txid" (JSON error
          // carrying the txid) when a previous attempt actually submitted the
          // transaction on-chain before crashing. Recover that txid instead of
          // failing or double-submitting.
          const parsed = parseSdkTxidError(e);
          if (parsed) {
            txid = parsed;
          } else {
            throw e;
          }
        }
        await ctx.runMutation(internal.piWithdrawals.updateWithdrawalStatus, {
          withdrawalId,
          status: "processing",
          paymentId,
          txid,
        });
      }

      // ---- Complete the payment, then verify Pi actually confirmed it -------
      const completed = await pi.completePayment(paymentId, txid);
      if (
        !completed ||
        completed.status?.developer_completed !== true ||
        completed.status?.transaction_verified !== true
      ) {
        throw new Error(
          `Pi payment not verified as completed (developer_completed=${completed?.status?.developer_completed}, transaction_verified=${completed?.status?.transaction_verified})`,
        );
      }

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
      await handlePayoutFailure(ctx, withdrawalId, errMsg);
    } finally {
      await ctx.runMutation(internal.piWithdrawals.releaseA2USlot, {});
      // Drain the next queued withdrawal.
      await ctx.scheduler.runAfter(0, internal.piWithdrawalsPayout.processA2UPayout, {});
    }
  },
});

// On failure: cancel the pending Pi payment (freeing the server-side slot so
// other A2U payments are never blocked), unless the transaction was actually
// verified on-chain — in which case the user received the Pi and we must not
// refund the points. Otherwise mark failed and refund the points.
async function handlePayoutFailure(ctx: any, withdrawalId: any, reason: string) {
  const withdrawal = await ctx.runQuery(internal.piWithdrawals.getWithdrawalByIdInternal, {
    withdrawalId,
  });
  if (!withdrawal || withdrawal.status !== "processing") return;

  const apiKey = process.env.PI_API_KEY ?? process.env.PI_API;
  const privateSeed = process.env.PI_WALLET_PRIVATE_SEED;
  if (apiKey && privateSeed && withdrawal.paymentId) {
    try {
      const PiNetwork = require("pi-backend");
      const pi = new PiNetwork(apiKey, privateSeed);
      try {
        await pi.cancelPayment(withdrawal.paymentId);
      } catch {
        // ignore cancel errors
      }
      try {
        const payment = await pi.getPayment(withdrawal.paymentId);
        if (payment?.status?.developer_completed || payment?.transaction?.verified) {
          // Pi actually moved on-chain: the user got their Pi. Mark completed,
          // do NOT refund the points.
          await ctx.runMutation(internal.piWithdrawals.updateWithdrawalStatus, {
            withdrawalId,
            status: "completed",
            paymentId: withdrawal.paymentId,
            txid: payment.transaction?.txid,
          });
          return;
        }
      } catch {
        // ignore lookup errors
      }
    } catch {
      // ignore SDK init errors
    }
  }

  await failAndRefund(ctx, withdrawal, reason);
}

async function failAndRefund(
  ctx: any,
  withdrawal: { _id: any; userId: any; pointsSpent: number },
  reason: string,
) {
  await ctx.runMutation(internal.piWithdrawals.updateWithdrawalStatus, {
    withdrawalId: withdrawal._id,
    status: "failed",
    failureReason: reason,
  });

  await ctx.runMutation(internal.points.creditHelper, {
    userId: withdrawal.userId,
    delta: withdrawal.pointsSpent,
    reason: `REFUND_PI_WITHDRAWAL_FAILED: ${reason}`,
  });
}

// pi-backend's submitPayment throws
//   JSON.stringify({ message: "This payment already has a linked txid", paymentId, txid })
// when the payment was already submitted on-chain. Extract the txid if present.
function parseSdkTxidError(err: unknown): string | null {
  try {
    const parsed = JSON.parse((err as Error).message);
    if (typeof parsed?.txid === "string") return parsed.txid;
  } catch {
    // not a JSON SDK error
  }
  return null;
}
