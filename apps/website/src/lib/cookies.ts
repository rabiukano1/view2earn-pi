// Client-side cookie helpers + the real cookies the View2Earn website sets.
// The site is a static export (Next `output: "export"`) on Cloudflare Pages, so
// there is no server runtime to set cookies — everything lives in the browser.

// --- Cookie names actually used on this site ---
export const CONSENT_COOKIE = "v2e_consent"; // "accepted" | "rejected" | ""
export const VISITOR_COOKIE = "v2e_vid"; // anonymous visitor id (uuid)
export const VISITS_COOKIE = "v2e_visits"; // total visit count
export const FIRST_VISIT_COOKIE = "v2e_first_visit"; // ISO timestamp of first visit
export const LAST_VISIT_COOKIE = "v2e_last_visit"; // ISO timestamp of most recent visit
export const LAST_PAGE_COOKIE = "v2e_last_page"; // last visited path

export const COOKIE_NAMES = [
  CONSENT_COOKIE,
  VISITOR_COOKIE,
  VISITS_COOKIE,
  FIRST_VISIT_COOKIE,
  LAST_VISIT_COOKIE,
  LAST_PAGE_COOKIE,
] as const;

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** Read a cookie value, or null if it isn't set. */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${encodeURIComponent(name)}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) {
      try {
        return decodeURIComponent(part.slice(prefix.length));
      } catch {
        return part.slice(prefix.length);
      }
    }
  }
  return null;
}

/** Set a cookie. `maxAgeSeconds` defaults to 1 year (rolls with page loads). */
export function setCookie(
  name: string,
  value: string,
  maxAgeSeconds: number = COOKIE_MAX_AGE_SECONDS,
): void {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value,
  )}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

/** Remove a cookie immediately. */
export function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0; SameSite=Lax`;
}

export type ConsentChoice = "accepted" | "rejected" | "";

/** The visitor's consent choice, or "" when they haven't decided yet. */
export function getConsent(): ConsentChoice {
  const value = getCookie(CONSENT_COOKIE);
  return value === "accepted" || value === "rejected" ? value : "";
}

/** Record the visitor's explicit cookie consent choice. */
export function setConsent(choice: "accepted" | "rejected"): void {
  setCookie(CONSENT_COOKIE, choice);
}

/** Generate a fresh anonymous visitor id (uuid v4). */
export function createVisitorId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  const rnd = (n: number) => Math.floor(Math.random() * n);
  const hex = (n: number) => n.toString(16);
  return (
    hex(rnd(0x100000000)).padStart(8, "0") +
    "-" +
    hex(rnd(0x10000)).padStart(4, "0") +
    "-4" +
    hex(rnd(0x1000)).padStart(3, "0") +
    "-" +
    hex(8 + rnd(4)) +
    hex(rnd(0x1000)).padStart(3, "0") +
    "-" +
    hex(rnd(0x100000000)).padStart(8, "0") +
    hex(rnd(0x10000)).padStart(4, "0")
  );
}

/** Ensure a `v2e_vid` exists, returning it (creates + persists on first call). */
export function getOrCreateVisitorId(): string {
  const existing = getCookie(VISITOR_COOKIE);
  if (existing) return existing;
  const id = createVisitorId();
  setCookie(VISITOR_COOKIE, id);
  return id;
}

/**
 * Called once per page view. Tracks visits (first visit + count + last visit)
 * and returns the values the visitor tracker sends to Convex. Consent itself
 * is managed separately by the consent banner.
 */
export function recordVisit(path: string): {
  vid: string;
  isNewVisit: boolean;
  visitNumber: number;
  firstVisitAt: number;
  lastVisitAt: number;
} {
  const vid = getOrCreateVisitorId();
  const now = Date.now();
  const rawFirst = getCookie(FIRST_VISIT_COOKIE);
  const rawLast = getCookie(LAST_VISIT_COOKIE);
  const firstVisitAt = rawFirst ? Number(rawFirst) || now : now;
  const lastVisitAt = rawLast ? Number(rawLast) || 0 : 0;

  // A "new visit" is a page view more than 30 minutes after the last one.
  const isNewVisit = now - lastVisitAt > 30 * 60 * 1000;
  const currentVisits = Number(getCookie(VISITS_COOKIE) || "0") || 0;
  const visitNumber = isNewVisit ? currentVisits + 1 : Math.max(1, currentVisits);

  setCookie(FIRST_VISIT_COOKIE, String(firstVisitAt), COOKIE_MAX_AGE_SECONDS);
  setCookie(LAST_VISIT_COOKIE, String(now), COOKIE_MAX_AGE_SECONDS);
  setCookie(VISITS_COOKIE, String(visitNumber), COOKIE_MAX_AGE_SECONDS);
  setCookie(LAST_PAGE_COOKIE, path, 60 * 60 * 24); // 1 day

  return {
    vid,
    isNewVisit,
    visitNumber,
    firstVisitAt,
    lastVisitAt: now,
  };
}

export { ONE_YEAR_MS };
