// Builds apps/pi-app in Telegram mode and copies the static export here.
// One codebase, two products: the mode is baked in at build time via
// NEXT_PUBLIC_APP_MODE=telegram; Adsgram block IDs come from ./.env.production.
//
// This used to build into a separate distDir (.next-tg) so the Pi build's
// output stayed untouched. Next 15.5 no longer carries a custom distDir
// through to the export step — it compiles into the custom dir and then reads
// its manifests from the default .next, which fails with ENOENT. So both
// builds now use the default .next/out, and this script wipes them before and
// after: a webpack cache entry from the Pi build must never leak into the
// Telegram bundle (or, worse, Adsgram into the Pi bundle, which Pi Network
// does not allow), and a Telegram export left in apps/pi-app/out would be
// published to the Pi domain by the next `wrangler pages deploy`.
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const piApp = path.join(__dirname, "..", "pi-app");
const piOut = path.join(piApp, "out");
const out = path.join(__dirname, "out");

const env = { ...process.env, NEXT_PUBLIC_APP_MODE: "telegram" };
const envFile = path.join(__dirname, ".env.production");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2]) env[m[1]] = m[2];
  }
}

const rm = (p) => fs.rmSync(p, { recursive: true, force: true });

rm(path.join(piApp, ".next"));
rm(piOut);

execSync("npx next build", { cwd: piApp, stdio: "inherit", env });

rm(out);
fs.cpSync(piOut, out, { recursive: true });
rm(piOut);
rm(path.join(piApp, ".next")); // next Pi build must not reuse Telegram-mode chunks

console.log(`tg-app: static export copied to ${out}`);
