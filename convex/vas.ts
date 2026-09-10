import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// Fetch redemption details and associated catalog item for fulfillment
export const getRedemptionForFulfillment = internalQuery({
  args: { redemptionId: v.id("redemptions") },
  handler: async (ctx, { redemptionId }) => {
    const redemption = await ctx.db.get(redemptionId);
    if (!redemption) return null;
    const catalogItem = await ctx.db.get(redemption.catalogId);
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
        
        // Auto-detect Nigerian network code if not specified: 01 MTN, 02 Glo, 03 9mobile, 04 Airtel
        let networkCode = "01";
        if (/^(0805|0807|0705|0815|0811|0905)/.test(phoneClean)) networkCode = "02"; // Glo
        else if (/^(0809|0818|0817|0909|0908)/.test(phoneClean)) networkCode = "03"; // 9mobile
        else if (/^(0802|0808|0708|0812|0902|0901|0904)/.test(phoneClean)) networkCode = "04"; // Airtel

        const isData = catalogItem?.itemType === "DATA";
        const amount = catalogItem?.pointsPrice ?? redemption.amount;
        const dataPlan = catalogItem?.providerSku ?? "1000"; // default plan code

        let apiUrl = "";
        if (isData) {
          apiUrl = `https://www.nellobytesystems.com/APIDataV1.asp?UserID=${ckUserId}&APIKey=${ckApiKey}&MobileNetwork=${networkCode}&DataPlan=${dataPlan}&MobileNumber=${phoneClean}&RequestID=${redemptionId}`;
        } else {
          // Airtime API
          const airtimeAmount = Math.max(100, Math.round(amount / 3)); // Map points price to NGN airtime amount
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
