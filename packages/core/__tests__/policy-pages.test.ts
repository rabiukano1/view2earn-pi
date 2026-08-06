import fs from "fs";
import path from "path";
import { ALL_POLICIES } from "../src/policies";
import type { PolicyKey } from "../src/policies";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

const ROUTE_BY_POLICY: Record<PolicyKey, string> = {
  privacy: "privacy",
  cookies: "cookies",
  "anti-fraud": "anti-fraud",
  rewards: "rewards-redemption",
};

function decodeHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => m.replace(/<[^>]*>/g, " "))
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\/g, "")
    .replace(/"/g, "")
    .replace(/\s+/g, " ");
}

function normalizeText(value: string): string {
  return value.replace(/\\/g, "").replace(/"/g, "").replace(/\s+/g, " ");
}

function firstContentSentinel(key: PolicyKey): string {
  const doc = ALL_POLICIES[key];
  const block = doc.blocks.find((b) => b.t === "p") ?? doc.blocks[0];
  if (block.t === "l") {
    return block.x[0];
  }
  return block.x;
}

describe("policy build smoke tests", () => {
  const apps: Array<{ name: string; outDir: string }> = [
    { name: "website", outDir: path.join(REPO_ROOT, "apps", "website", "out") },
    { name: "pi-app", outDir: path.join(REPO_ROOT, "apps", "pi-app", "out") },
  ];

  for (const app of apps) {
    if (!fs.existsSync(app.outDir)) {
      // Build the app (npm run website:build / pi:build) to enable this smoke test.
      console.log(`[policy-pages] ${app.name}: no out/ dir, skipping build smoke test`);
      continue;
    }

    describe(app.name, () => {
      for (const key of Object.keys(ALL_POLICIES) as PolicyKey[]) {
        const route = ROUTE_BY_POLICY[key];

        it(`${route}.html contains ${key} title, date, and body content`, () => {
          const file = path.join(app.outDir, `${route}.html`);
          expect(fs.existsSync(file)).toBe(true);

          const doc = ALL_POLICIES[key];
          const text = decodeHtml(fs.readFileSync(file, "utf8"));

          expect(text).toContain(normalizeText(doc.title));
          expect(text).toContain("Last Updated:");
          expect(text).toContain(doc.lastUpdated);
          expect(text).toContain(normalizeText(firstContentSentinel(key)));
        });
      }

      it("terms.html exists and contains terms content", () => {
        const file = path.join(app.outDir, "terms.html");
        expect(fs.existsSync(file)).toBe(true);

        const text = decodeHtml(fs.readFileSync(file, "utf8"));
        expect(text).toContain("Terms & Conditions");
        expect(text).toContain("Official Agreement");
        expect(text).toContain("Last Updated: August 2026");
      });
    });
  }
});
