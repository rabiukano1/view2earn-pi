#!/usr/bin/env node
// Copy Convex environment variables into the CURRENTLY SELECTED deployment.
//
//   node scripts/copy-env-vars.mjs [file]        default: .env.convex-backup
//
// The file is `KEY=VALUE` per line, as produced by:
//   npm run use:cloud && npx convex env list > .env.convex-backup
//
// Values are never printed — not to the console, not to logs. Only names are
// shown, and you must confirm before anything is written.
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = resolve(ROOT, process.argv[2] ?? ".env.convex-backup");
// Call the Convex CLI through node directly. Spawning `npx.cmd` without a
// shell fails on Windows with Node >= 20.12 (EINVAL, the CVE-2024-27980 fix),
// and using a shell would mean escaping every value. This avoids both.
const CONVEX_CLI = resolve(ROOT, "node_modules", "convex", "bin", "main.js");

// Convex provides these itself; setting them is rejected.
const RESERVED = /^CONVEX_(SITE_URL|CLOUD_URL|DEPLOYMENT|SELF_HOSTED_)/;

if (!existsSync(CONVEX_CLI)) {
  console.error(`Convex CLI not found at ${CONVEX_CLI}. Run: npm install`);
  process.exit(1);
}

if (!existsSync(file)) {
  console.error(`Missing ${file}.\nCreate it with:  npx convex env list > .env.convex-backup`);
  process.exit(1);
}

const entries = [];
for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
  if (!line.trim() || line.trimStart().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i <= 0) continue;
  const key = line.slice(0, i).trim();
  const value = line.slice(i + 1);
  if (RESERVED.test(key)) continue;
  entries.push({ key, value });
}

if (entries.length === 0) {
  console.error("No KEY=VALUE lines found.");
  process.exit(1);
}

// Which target is selected right now? Show it so nobody writes to the wrong one.
const envLocal = resolve(ROOT, ".env.local");
const localText = existsSync(envLocal) ? readFileSync(envLocal, "utf8") : "";
const selfHosted = /^CONVEX_SELF_HOSTED_URL=(.+)$/m.exec(localText)?.[1]?.trim();
const deployment = /^CONVEX_DEPLOYMENT=(.+)$/m.exec(localText)?.[1]?.trim();
const target = selfHosted ?? deployment ?? "(unknown — check .env.local)";

// Flag — by NAME only — values that still point at the old cloud deployment.
const stale = entries
  .filter((e) => /convex\.cloud|convex\.site/.test(e.value))
  .map((e) => e.key);

console.log(`\nTarget deployment : ${target}`);
console.log(`Source file       : ${file}`);
console.log(`\n${entries.length} variable(s) will be set (values hidden):`);
for (const { key } of entries) console.log(`  - ${key}`);
if (stale.length) {
  console.log(`\n⚠  These still contain an old convex.cloud/.site URL — update them after copying:`);
  for (const k of stale) console.log(`  ! ${k}`);
}

const rl = createInterface({ input: stdin, output: stdout });
const answer = await rl.question(`\nWrite these ${entries.length} variable(s) to ${target}? (type: yes) `);
rl.close();
if (answer.trim() !== "yes") {
  console.log("Aborted. Nothing was written.");
  process.exit(1);
}

let ok = 0;
const failed = [];
for (const { key, value } of entries) {
  // argv array, not a shell string: values with spaces/quotes/$ stay intact.
  // "--" stops option parsing, so a value starting with "-" (e.g. the
  // "-----BEGIN PRIVATE KEY-----" PEM in JWT_PRIVATE_KEY) is not read as a flag.
  // (The CLI also has `convex env set --from-file <file>` to apply a whole
  // KEY=VALUE file at once; this loop exists for the per-key confirmation.)
  const r = spawnSync(process.execPath, [CONVEX_CLI, "env", "set", "--", key, value], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "pipe"],
    encoding: "utf8",
  });
  if (r.status === 0) {
    ok++;
    console.log(`  set ${key}`);
  } else {
    failed.push(key);
    // Show WHY, but strip anything that could contain the value itself.
    const why = (r.error?.message ?? r.stderr ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.includes(value))
      .slice(0, 2)
      .join(" | ");
    console.log(`  FAILED ${key}${why ? `  (${why})` : ""}`);
  }
}

console.log(`\n${ok}/${entries.length} set.`);
if (failed.length) {
  console.log(`Failed: ${failed.join(", ")}`);
  process.exit(1);
}
if (stale.length) {
  console.log(`Remember to update: ${stale.join(", ")}`);
}
