import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUserAndEconomy } from "./lib/guards";
import { enforceRateLimit } from "./lib/ratelimit";
import { appendLedger } from "./lib/ledger";
import { getNum } from "./rewardsConfig";

// ─── Wallet-app data & airtime (ClubKonnect) ────────────────────────────────
// Plans + ₦ costs come live from ClubKonnect (refreshPlans → vasPlans). The
// user picks network → plan (or airtime amount) → phone; `buy` prices it
// server-side at vasPointsPerNaira, debits the wallet pool, and `fulfill`
// sends it. A failed order is refunded (rewards.refundRedemption).

const NETWORK_CODE: Record<string, string> = { MTN: "01", GLO: "02", "9MOBILE": "03", AIRTEL: "04" };
// ClubKonnect's keys in APIDatabundlePlansV2 → our network names.
const CK_NETWORK: Record<string, string> = { MTN: "MTN", Glo: "GLO", m_9mobile: "9MOBILE", Airtel: "AIRTEL" };
const AIRTIME_MIN = 50;
const AIRTIME_MAX = 20000;

type CkPlans = {
  MOBILE_NETWORK?: Record<string, { PRODUCT?: { PRODUCT_ID: string; PRODUCT_NAME: string; PRODUCT_AMOUNT: string }[] }[]>;
};

export const refreshPlans = internalAction({
  args: {},
  handler: async (ctx): Promise<{ plans: number }> => {
    const userId = process.env.CLUBKONNECT_USER_ID;
    if (!userId) return { plans: 0 };
    const res = await fetch(`https://www.nellobytesystems.com/APIDatabundlePlansV2.asp?UserID=${userId}`);
    if (!res.ok) throw new Error(`ClubKonnect plans HTTP ${res.status}`);
    const json = (await res.json()) as CkPlans;
    const plans = Object.entries(json.MOBILE_NETWORK ?? {})
      .flatMap(([key, nets]) =>
        CK_NETWORK[key]
          ? (nets[0]?.PRODUCT ?? []).map((pr) => ({
              network: CK_NETWORK[key],
              planId: pr.PRODUCT_ID,
              name: pr.PRODUCT_NAME,
              costNaira: Number(pr.PRODUCT_AMOUNT),
            }))
          : [],
      )
      .filter((pl) => pl.planId && pl.costNaira > 0);
    // An empty/garbled response keeps the old list instead of wiping it.
    if (!plans.length) throw new Error("ClubKonnect returned no plans");
    await ctx.runMutation(internal.vas.replacePlans, { plans });
    return { plans: plans.length };
  },
});

export const replacePlans = internalMutation({
  args: { plans: v.array(v.object({ network: v.string(), planId: v.string(), name: v.string(), costNaira: v.number() })) },
  handler: async (ctx, { plans }) => {
    for (const old of await ctx.db.query("vasPlans").collect()) await ctx.db.delete(old._id);
    for (const pl of plans) await ctx.db.insert("vasPlans", pl);
  },
});

/** Data plans for one network, priced in points (for the buy screen). */
export const listPlans = query({
  args: { network: v.string() },
  handler: async (ctx, { network }) => {
    const rate = await getNum(ctx, "vasPointsPerNaira");
    const plans = await ctx.db.query("vasPlans").withIndex("by_network", (q) => q.eq("network", network)).collect();
    return plans
      .map((pl) => ({ planId: pl.planId, name: pl.name, points: Math.ceil(pl.costNaira * rate) }))
      .sort((a, b) => a.points - b.points);
  },
});

export const airtimeRate = query({
  args: {},
  handler: async (ctx) => ({ pointsPerNaira: await getNum(ctx, "vasPointsPerNaira"), min: AIRTIME_MIN, max: AIRTIME_MAX }),
});

// "+234 803…" / "234803…" / "0803…" → "0803…"; null if not a Nigerian mobile.
export function normalizeNgPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("234") ? "0" + digits.slice(3) : digits;
  return /^0[789][01]\d{8}$/.test(local) ? local : null;
}

export const buy = mutation({
  args: {
    userId: v.id("users"),
    kind: v.union(v.literal("DATA"), v.literal("AIRTIME")),
    network: v.string(),
    phoneNumber: v.string(),
    planId: v.optional(v.string()), // DATA
    amountNaira: v.optional(v.number()), // AIRTIME
  },
  handler: async (ctx, { userId, kind, network, phoneNumber, planId, amountNaira }) => {
    const { economy } = await requireUserAndEconomy(ctx, userId);
    if (economy !== "wallet") throw new Error("Buy data from the View2Earn Wallet app.");
    await enforceRateLimit(ctx, userId, "redeem");
    if (!NETWORK_CODE[network]) throw new Error("Pick a network");
    const phone = normalizeNgPhone(phoneNumber);
    if (!phone) throw new Error("Enter a valid Nigerian phone number, e.g. 08031234567");
    const rate = await getNum(ctx, "vasPointsPerNaira");
    if (rate <= 0) throw new Error("Data & airtime aren't available right now.");

    // Price is always computed here from our own plan list, never from the client.
    let nairaAmount: number;
    let planName: string;
    if (kind === "DATA") {
      const plan = (await ctx.db.query("vasPlans").withIndex("by_network", (q) => q.eq("network", network)).collect())
        .find((pl) => pl.planId === planId);
      if (!plan) throw new Error("That data plan isn't available any more. Pick another.");
      nairaAmount = plan.costNaira;
      planName = `${network} ${plan.name}`;
    } else {
      if (!amountNaira || !Number.isInteger(amountNaira) || amountNaira < AIRTIME_MIN || amountNaira > AIRTIME_MAX) {
        throw new Error(`Airtime must be a whole amount from ₦${AIRTIME_MIN} to ₦${AIRTIME_MAX.toLocaleString()}`);
      }
      nairaAmount = amountNaira;
      planName = `${network} ₦${amountNaira} airtime`;
    }
    const points = Math.ceil(nairaAmount * rate);

    const redemptionId = await ctx.db.insert("redemptions", {
      userId,
      economy: "wallet",
      itemType: kind,
      network,
      planId: kind === "DATA" ? planId : undefined,
      planName,
      nairaAmount,
      paidWith: "POINTS",
      amount: points,
      phoneNumber: phone,
      status: "processing",
    });
    // Throws (rolling back the insert) if the wallet balance is short.
    const balanceAfter = await appendLedger(ctx, userId, "wallet", -points, "VAS_PURCHASE", redemptionId);
    await ctx.db.insert("walletTransactions", {
      userId,
      type: "buy_vas_points",
      pointsDelta: -points,
      piproDelta: 0,
      pointsBalanceAfter: balanceAfter,
      piproBalanceAfter: 0,
      note: `${planName} → ${phone}`,
    });
    await ctx.scheduler.runAfter(0, internal.vas.fulfill, { redemptionId });
    return { redemptionId, points, balanceAfter };
  },
});

// Fetch redemption details and associated catalog item for fulfillment
export const getRedemptionForFulfillment = internalQuery({
  args: { redemptionId: v.id("redemptions") },
  handler: async (ctx, { redemptionId }) => {
    const redemption = await ctx.db.get(redemptionId);
    if (!redemption) return null;
    const catalogItem = redemption.catalogId ? await ctx.db.get(redemption.catalogId) : null;
    return { redemption, catalogItem };
  },
});

// Automated VAS Airtime & Data Fulfillment Action (Plan §7.8b)
// Supports Reloadly Topup REST API & Dev Sandbox Mode with Auto-Refunds.
export const fulfill = internalAction({
  args: { redemptionId: v.id("redemptions") },
  handler: async (ctx, { redemptionId }) => {
    const data = await ctx.runQuery(internal.vas.getRedemptionForFulfillment, {
      redemptionId,
    });

    if (!data || !data.redemption) {
      console.error(`[VAS Fulfillment] Redemption ${redemptionId} not found`);
      return;
    }

    const { redemption, catalogItem } = data;

    if (redemption.status !== "processing") {
      console.log(`[VAS Fulfillment] Skipping redemption ${redemptionId} in status ${redemption.status}`);
      return;
    }

    const ckUserId = process.env.CLUBKONNECT_USER_ID;
    const ckApiKey = process.env.CLUBKONNECT_API_KEY;
    const clientId = process.env.RELOADLY_CLIENT_ID;
    const clientSecret = process.env.RELOADLY_CLIENT_SECRET;
    const isSandbox = process.env.RELOADLY_SANDBOX !== "false";

    // -----------------------------------------------------------------------
    // 1. CLUBKONNECT / NELLO BYTE SYSTEMS API (Best for Individual Developers)
    // -----------------------------------------------------------------------
    if (ckUserId && ckApiKey) {
      try {
        console.log(`[VAS Fulfillment] Processing redemption ${redemptionId} via ClubKonnect API...`);
        const phoneClean = redemption.phoneNumber.replace(/[^0-9]/g, "").slice(-11);
        
        // The network the user picked; old catalog orders fall back to guessing
        // from the prefix: 01 MTN, 02 Glo, 03 9mobile, 04 Airtel.
        let networkCode = NETWORK_CODE[redemption.network ?? ""] ?? "01";
        if (!redemption.network) {
          if (/^(0805|0807|0705|0815|0811|0905)/.test(phoneClean)) networkCode = "02"; // Glo
          else if (/^(0809|0818|0817|0909|0908)/.test(phoneClean)) networkCode = "03"; // 9mobile
          else if (/^(0802|0808|0708|0812|0902|0901|0904)/.test(phoneClean)) networkCode = "04"; // Airtel
        }

        const isData = (redemption.itemType ?? catalogItem?.itemType) === "DATA";
        const amount = catalogItem?.pointsPrice ?? redemption.amount;
        const dataPlan = redemption.planId ?? catalogItem?.providerSku ?? "1000";

        let apiUrl = "";
        if (isData) {
          apiUrl = `https://www.nellobytesystems.com/APIDatabundleV1.asp?UserID=${ckUserId}&APIKey=${ckApiKey}&MobileNetwork=${networkCode}&DataPlan=${dataPlan}&MobileNumber=${phoneClean}&RequestID=${redemptionId}`;
        } else {
          // Airtime API
          const airtimeAmount = redemption.nairaAmount ?? Math.max(100, Math.round(amount / 3)); // legacy catalog: points → ₦
          apiUrl = `https://www.nellobytesystems.com/APIAirtimeV1.asp?UserID=${ckUserId}&APIKey=${ckApiKey}&MobileNetwork=${networkCode}&Amount=${airtimeAmount}&MobileNumber=${phoneClean}&RequestID=${redemptionId}`;
        }

        const ckRes = await fetch(apiUrl);
        const ckData = await ckRes.json().catch(() => null);

        if (ckRes.ok && ckData && (ckData.status === "ORDER_RECEIVED" || ckData.status === "ORDER_COMPLETED" || ckData.status_code === "100" || ckData.status_code === "200")) {
          const providerRef = String(ckData.orderid || ckData.order_id || `ck-${Date.now()}`);
          await ctx.runMutation(internal.rewards.markFulfilled, {
            redemptionId,
            providerRef,
          });
          console.log(`[VAS Fulfillment] Successfully fulfilled via ClubKonnect ref ${providerRef}`);
          return;
        } else {
          const errMsg = ckData?.msg || ckData?.status || `Status HTTP ${ckRes.status}`;
          throw new Error(`ClubKonnect API failure: ${errMsg}`);
        }
      } catch (err) {
        console.error(`[VAS Fulfillment] ClubKonnect failed for ${redemptionId}:`, err);
        await ctx.runMutation(internal.rewards.refundRedemption, {
          redemptionId,
          reason: `REFUND_CLUBKONNECT_FAILED: ${(err as Error)?.message ?? "API Error"}`,
        });
        return;
      }
    }

    // -----------------------------------------------------------------------
    // 2. DEV SANDBOX MODE (Runs if no API keys are configured)
    // -----------------------------------------------------------------------
    if (!clientId || !clientSecret) {
      console.log(`[VAS Fulfillment] No RELOADLY or CLUBKONNECT credentials configured. Simulating Dev Sandbox fulfillment for ${redemption.phoneNumber}...`);
      
      const mockRef = `mock-vas-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await ctx.runMutation(internal.rewards.markFulfilled, {
        redemptionId,
        providerRef: mockRef,
      });
      return;
    }

    // -----------------------------------------------------------------------
    // 3. LIVE / SANDBOX RELOADLY TOPUP API
    // -----------------------------------------------------------------------
    try {
      // Step 1: Obtain Reloadly OAuth2 Token
      const authUrl = isSandbox
        ? "https://auth-sandbox.reloadly.com/oauth/token"
        : "https://auth.reloadly.com/oauth/token";
      
      const audience = isSandbox
        ? "https://topups-sandbox.reloadly.com"
        : "https://topups.reloadly.com";

      const tokenRes = await fetch(authUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "client_credentials",
          audience,
        }),
      });

      if (!tokenRes.ok) {
        throw new Error(`Reloadly OAuth failed (${tokenRes.status}): ${await tokenRes.text()}`);
      }

      const tokenData = (await tokenRes.json()) as { access_token?: string };
      const accessToken = tokenData.access_token;

      if (!accessToken) {
        throw new Error("Reloadly access token missing in auth response");
      }

      // Step 2: Send Airtime / Data Top-up Request
      const topupUrl = `${audience}/topups`;
      const sku = catalogItem?.providerSku ?? "data-1gb";
      const amount = catalogItem?.pointsPrice ?? redemption.amount;

      const topupRes = await fetch(topupUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/com.reloadly.topups-v1+json",
        },
        body: JSON.stringify({
          operatorId: sku,
          amount,
          useLocalAmount: false,
          customIdentifier: redemptionId,
          recipientPhone: {
            countryCode: "NG", // Default market; operator autodetect fallback
            number: redemption.phoneNumber,
          },
        }),
      });

      if (!topupRes.ok) {
        const errText = await topupRes.text();
        throw new Error(`Reloadly Topup API Error (${topupRes.status}): ${errText}`);
      }

      const topupResult = (await topupRes.json()) as { transactionId?: number | string };
      const providerRef = topupResult.transactionId ? String(topupResult.transactionId) : `vas-${Date.now()}`;

      // Step 3: Mark Fulfilled
      await ctx.runMutation(internal.rewards.markFulfilled, {
        redemptionId,
        providerRef,
      });

      console.log(`[VAS Fulfillment] Successfully fulfilled redemption ${redemptionId} via Reloadly ref ${providerRef}`);
    } catch (err) {
      console.error(`[VAS Fulfillment] Fulfillment failed for redemption ${redemptionId}:`, err);

      // AUTO-REFUND: Refund user's points back to ledger on error
      await ctx.runMutation(internal.rewards.refundRedemption, {
        redemptionId,
        reason: `REFUND_VAS_FAILED: ${(err as Error)?.message ?? "API Error"}`,
      });
    }
  },
});
