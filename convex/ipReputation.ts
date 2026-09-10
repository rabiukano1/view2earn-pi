import { recomputeUserScore } from "./fraud";

export interface IpReputationResult {
  ip: string;
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  isDataCenter: boolean;
  riskScore: number; // 0 (clean) to 100 (high risk)
}

// Well-known VPN, Proxy, and Data Center IP subnet prefixes / patterns
const VPN_DATACENTER_PATTERNS = [
  /^185\.220\./, // Tor Exit Nodes
  /^198\.96\./,  // Tor Nodes
  /^172\.56\./,  // Data Center Proxy
  /^23\.129\./,  // Tor Network
  /^104\.244\./, // Data Center Hosting
  /^185\.107\./, // Commercial VPN Range
];

/**
 * Evaluates IP address reputation to detect VPNs, Proxies, Tor nodes, and Data Centers.
 * Safe for local development / emulators (127.0.0.1, 10.0.2.2, 192.168.x.x).
 */
export async function checkIpReputation(ip?: string): Promise<IpReputationResult> {
  const cleanIp = (ip ?? "").trim();

  // Local / Emulator / Private IP Range Check (Clean for dev)
  if (
    !cleanIp ||
    cleanIp === "127.0.0.1" ||
    cleanIp === "::1" ||
    cleanIp.startsWith("10.0.2.") ||
    cleanIp.startsWith("192.168.") ||
    cleanIp.startsWith("172.16.")
  ) {
    return {
      ip: cleanIp || "127.0.0.1",
      isVpn: false,
      isProxy: false,
      isTor: false,
      isDataCenter: false,
      riskScore: 0,
    };
  }

  // Check known VPN / Data Center / Tor patterns
  const matchesVpnPattern = VPN_DATACENTER_PATTERNS.some((p) => p.test(cleanIp));

  // If IPQualityScore API key is configured, perform live lookup
  const apiKey = process.env.IPQUALITYSCORE_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        `https://ipqualityscore.com/api/json/ip/${apiKey}/${cleanIp}?strictness=1`
      );
      if (res.ok) {
        const data = await res.json() as any;
        return {
          ip: cleanIp,
          isVpn: Boolean(data.vpn),
          isProxy: Boolean(data.proxy),
          isTor: Boolean(data.tor),
          isDataCenter: Boolean(data.is_crawler || data.active_vpn),
          riskScore: Number(data.fraud_score ?? (matchesVpnPattern ? 85 : 0)),
        };
      }
    } catch {
      // Fall back to pattern heuristic if API unreachable
    }
  }

  return {
    ip: cleanIp,
    isVpn: matchesVpnPattern,
    isProxy: matchesVpnPattern,
    isTor: matchesVpnPattern,
    isDataCenter: matchesVpnPattern,
    riskScore: matchesVpnPattern ? 85 : 10,
  };
}

/**
 * Logs a fraud event and recomputes the user's fraud score if a VPN or proxy is detected.
 */
export async function recordIpFraudSignal(
  ctx: any,
  userId: any,
  ipInfo: IpReputationResult
): Promise<boolean> {
  if (ipInfo.isVpn || ipInfo.isProxy || ipInfo.isTor || ipInfo.riskScore >= 75) {
    await ctx.db.insert("fraudEvents", {
      userId,
      type: ipInfo.isTor ? "ip-tor-detected" : ipInfo.isVpn ? "ip-vpn-detected" : "ip-proxy-detected",
      details: `Suspicious IP connection detected: ${ipInfo.ip} (Risk Score: ${ipInfo.riskScore}/100)`,
    });

    // Recompute user's fraud score immediately
    await recomputeUserScore(ctx, userId);
    return true;
  }
  return false;
}
