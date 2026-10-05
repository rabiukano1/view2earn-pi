// Backend origins for the admin panel. On self-hosted Convex the HTTP-actions
// origin is a separate host, so it has its own env var — never derive it from
// NEXT_PUBLIC_CONVEX_URL by string replacement.
export const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
export const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
