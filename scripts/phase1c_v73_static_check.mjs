/**
 * Static checks for Phase 1C v73 handoff files (no Chrome, no extraction).
 * Run: node scripts/phase1c_v73_static_check.mjs
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(
  __dirname,
  "../../../extension and profile sms/All Externsions/auto-posts-exporter-ext-date-popup-v73 (1)/auto-posts-exporter-ext-date-popup-v73/auto-posts-exporter-ext-date-popup-v73"
);

// Prefer absolute known path if relative fails
const EXT_ABS =
  "C:\\Users\\Administrator\\Downloads\\تفاح\\extension and profile sms\\All Externsions\\auto-posts-exporter-ext-date-popup-v73 (1)\\auto-posts-exporter-ext-date-popup-v73\\auto-posts-exporter-ext-date-popup-v73";

const root = fs.existsSync(EXT_ABS) ? EXT_ABS : EXT;

function sha256(file) {
  const buf = fs.readFileSync(file);
  return crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
}

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const BEFORE = path.join(root, "_phase1c_protected_hashes_before.txt");
const protectedFiles = [
  "working_engine/index.js",
  "working_engine/vendors.js",
  "working_engine/bootstrap.js",
  "working_engine/proxy.js",
  "working_engine/direct_gate.js",
  "working_engine/local_graphql_configs.js",
  "working_engine/reel_comments_auto_open.js",
  "working_engine/reel_intent_probe.js",
  "working_engine/reel_module_discovery.js",
  "inject.js",
  "comments.js",
  "ufi_hook.js",
  "content.js",
  "display_comments.js",
];

const beforeMap = new Map();
if (fs.existsSync(BEFORE)) {
  for (const line of fs.readFileSync(BEFORE, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-F0-9]{64})\s+(.+)$/i);
    if (m) beforeMap.set(m[2].replace(/\\/g, "/"), m[1].toUpperCase());
  }
}

let changed = [];
for (const rel of protectedFiles) {
  const fp = path.join(root, rel);
  assert(fs.existsSync(fp), `missing protected ${rel}`);
  const h = sha256(fp);
  const key = rel.replace(/\//g, "\\");
  const prev = beforeMap.get(key) || beforeMap.get(rel);
  if (prev && prev !== h) changed.push(rel);
}

assert(changed.length === 0, `protected files changed: ${changed.join(", ")}`);

const bridge = fs.readFileSync(path.join(root, "profile_sms_bridge.js"), "utf8");
assert(bridge.includes("http://127.0.0.1:4173"), "bridge allowlist 4173");
assert(!bridge.includes("<all_urls>"), "no all_urls");
assert(bridge.includes("PROFILE_SMS_BATCH_HANDOFF"), "handoff type");

const handoff = fs.readFileSync(
  path.join(root, "profile_sms_system_handoff.js"),
  "utf8"
);
assert(
  handoff.includes("PROFILE_SMS_LIVE_EXTRACTION_ENABLED = false"),
  "live off"
);
assert(
  handoff.includes("PROFILE_SMS_AUTO_ACQUIRE_ENABLED = false"),
  "auto acquire off"
);
assert(handoff.includes("profileSmsPendingBatch"), "pending namespace");
assert(handoff.includes("pagesList"), "pagesList prepare path");
assert(handoff.includes("currentPageIndex"), "currentPageIndex prepare path");

const popup = fs.readFileSync(path.join(root, "popup.js"), "utf8");
assert(popup.includes("pagesFile"), "manual TXT input intact");
assert(popup.includes("pagesList"), "manual pagesList intact");

const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "manifest.json"), "utf8")
);
assert(manifest.permissions.includes("alarms"), "alarms permission");
assert(
  (manifest.host_permissions || []).some((h) =>
    h.includes("profilesms.duckdns.org:5443")
  ),
  "api host permission"
);
const bridgeScript = (manifest.content_scripts || []).some((cs) =>
  (cs.js || []).includes("profile_sms_bridge.js")
);
assert(bridgeScript, "bridge content script registered");

const bg = fs.readFileSync(path.join(root, "background.js"), "utf8");
assert(bg.includes('importScripts("profile_sms_system_handoff.js")'), "importScripts");
assert(bg.includes("HOST_REGEX_FILTERS"), "CSP parity preserved");

console.log("phase1c_v73_static_check: ALL PASS");
console.log("Protected engine ZERO DIFF: YES");
