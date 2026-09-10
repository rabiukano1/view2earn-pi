import fs from "fs";
import path from "path";
import { ALL_POLICIES, getPolicyDoc } from "../src/policies";
import type { PolicyKey } from "../src/policies";

const POLICY_KEYS = Object.keys(ALL_POLICIES) as PolicyKey[];

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

const ROUTE_BY_POLICY: Record<PolicyKey, string> = {
  privacy: "privacy",
  cookies: "cookies",
  "anti-fraud": "anti-fraud",
  rewards: "rewards-redemption",
};

describe("policies", () => {
  it("registers all four policies", () => {
    expect(POLICY_KEYS.sort()).toEqual(["anti-fraud", "cookies", "privacy", "rewards"]);
  });

  it.each(POLICY_KEYS.map((key) => [key, getPolicyDoc(key).title]))("%s has a title", (_, title) => {
    expect(typeof title).toBe("string");
    expect((title as string).length).toBeGreaterThan(0);
  });

  it.each(POLICY_KEYS)("%s has a badge and last updated date", (key) => {
    const doc = getPolicyDoc(key as PolicyKey);
    expect(doc.badge.length).toBeGreaterThan(0);
    expect(doc.lastUpdated).toMatch(/August 2026/i);
  });

  it.each(POLICY_KEYS)("%s has at least one block", (key) => {
    const doc = getPolicyDoc(key as PolicyKey);
    expect(doc.blocks.length).toBeGreaterThan(0);
  });

  it.each(POLICY_KEYS)("%s uses valid block shapes", (key) => {
    const doc = getPolicyDoc(key as PolicyKey);
    for (const block of doc.blocks) {
      expect(["h", "s", "p", "l"]).toContain(block.t);
      if (block.t === "l") {
        expect(Array.isArray(block.x)).toBe(true);
        expect(block.x.length).toBeGreaterThan(0);
      } else {
        expect(typeof block.x).toBe("string");
        expect((block.x as string).length).toBeGreaterThan(0);
      }
    }
  });

  it.each(POLICY_KEYS)("every policy mentions view2earn.org", (key) => {
    const doc = getPolicyDoc(key as PolicyKey);
    const text = doc.blocks.map((b) => (b.t === "l" ? b.x.join(" ") : b.x)).join(" ");
    expect(text).toMatch(/view2earn\.org/i);
  });
});

describe("policy surface parity", () => {
  it.each(POLICY_KEYS)("%s has a route page in the website app", (key) => {
    const route = ROUTE_BY_POLICY[key as PolicyKey];
    const file = path.join(REPO_ROOT, "apps", "website", "src", "app", route, "page.tsx");
    expect(fs.existsSync(file)).toBe(true);
  });

  it.each(POLICY_KEYS)("%s has a route page in the pi-app", (key) => {
    const route = ROUTE_BY_POLICY[key as PolicyKey];
    const file = path.join(REPO_ROOT, "apps", "pi-app", "src", "app", route, "page.tsx");
    expect(fs.existsSync(file)).toBe(true);
  });

  it("website and pi-app each have a terms route", () => {
    expect(fs.existsSync(path.join(REPO_ROOT, "apps", "website", "src", "app", "terms", "page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(REPO_ROOT, "apps", "pi-app", "src", "app", "terms", "page.tsx"))).toBe(true);
  });

  it("website privacy route uses the shared PolicyPageContent", () => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, "apps", "website", "src", "app", "privacy", "page.tsx"),
      "utf8",
    );
    expect(source).toContain("PolicyPageContent");
    expect(source).toContain('policy="privacy"');
  });

  it("mobile exposes a shared Policy screen with a policy param", () => {
    const screen = path.join(REPO_ROOT, "src", "screens", "PolicyScreen.tsx");
    const types = path.join(REPO_ROOT, "src", "navigation", "types.ts");
    expect(fs.existsSync(screen)).toBe(true);
    const typesSource = fs.readFileSync(types, "utf8");
    expect(typesSource).toMatch(/Policy.*policy/);
  });

  it("mobile has no legacy hardcoded privacy screen", () => {
    const legacy = path.join(REPO_ROOT, "src", "screens", "PrivacyPolicyScreen.tsx");
    expect(fs.existsSync(legacy)).toBe(false);
  });
});
