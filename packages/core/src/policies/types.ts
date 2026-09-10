export type PolicyBlock =
  | { t: "h"; x: string }
  | { t: "s"; x: string }
  | { t: "p"; x: string }
  | { t: "l"; x: string[] };

export type PolicyKey = "privacy" | "cookies" | "anti-fraud" | "rewards";

export type PolicyDoc = {
  key: PolicyKey;
  title: string;
  badge: string;
  lastUpdated: string;
  blocks: PolicyBlock[];
};
