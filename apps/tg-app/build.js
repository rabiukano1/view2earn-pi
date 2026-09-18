// Builds apps/pi-app in Telegram mode and copies the static export here.
// One codebase, two products: the mode is baked in at build time via
// NEXT_PUBLIC_APP_MODE=telegram; Adsgram block IDs come from ./.env.production.
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const piApp = path.join(__dirname, "..", "pi-app");
const env = { ...process.env, NEXT_PUBLIC_APP_MODE: "telegram", NEXT_DIST_DIR: ".next-tg" };
const envFile = path.join(__dirname, ".env.production");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2]) env[m[1]] = m[2];
  }
}

execSync("npx next build", { cwd: piApp, stdio: "inherit", env });

// With a custom distDir, `output: "export"` writes the site into distDir itself.
const out = path.join(__dirname, "out");
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(piApp, ".next-tg"), out, {
  recursive: true,
  filter: (src) => !/[\/]\.next-tg[\/](cache|server|static|types|diagnostics)([\/]|$)|BUILD_ID$|\.json$|\.nft$/.test(src),
});
console.log(`tg-app: static export copied to ${out}`);
