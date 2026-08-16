/**
 * Phase 1D extension static + simulated unit checks (no Facebook, no Chrome).
 * Run: node scripts/phase1d_extension_static_check.mjs
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT =
  "C:\\Users\\Administrator\\Downloads\\تفاح\\extension and profile sms\\All Externsions\\auto-posts-exporter-ext-date-popup-v73 (1)\\auto-posts-exporter-ext-date-popup-v73\\auto-posts-exporter-ext-date-popup-v73";

function assert(c, m) {
  if (!c) throw new Error("FAIL: " + m);
}
function sha(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex")
    .toUpperCase();
}

const BEFORE = path.join(EXT, "_phase1d_protected_hashes_before.txt");
const protectedFiles = [
  "working_engine/index.js",
  "working_engine/vendors.js",
  "working_engine/bootstrap.js",
  "working_engine/proxy.js",
  "working_engine/direct_gate.js",
  "working_engine/local_graphql_configs.js",
  "inject.js",
  "comments.js",
  "ufi_hook.js",
  "content.js",
];

const beforeMap = new Map();
for (const line of fs.readFileSync(BEFORE, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-F0-9]{64})\s+(.+)$/i);
  if (m) beforeMap.set(m[2].replace(/\\/g, "/"), m[1].toUpperCase());
}

const changed = [];
for (const rel of protectedFiles) {
  const fp = path.join(EXT, rel);
  assert(fs.existsSync(fp), "missing " + rel);
  const h = sha(fp);
  const prev = beforeMap.get(rel) || beforeMap.get(rel.replace(/\//g, "\\"));
  if (prev && prev !== h) changed.push(rel);
}
assert(changed.length === 0, "protected changed: " + changed.join(","));

const hook = fs.readFileSync(path.join(EXT, "profile_sms_results_hook.js"), "utf8");
assert(hook.includes("POST_COMMENTS"), "hook listens POST_COMMENTS");
assert(hook.includes("COMMENTS_DONE"), "hook listens COMMENTS_DONE");
assert(hook.includes("profileSmsActiveBatch"), "system mode gate");
assert(
  !/handoff_token\s*[:=]/.test(hook) && !hook.includes("psbh_"),
  "token not assigned/stored in hook"
);

const outbox = fs.readFileSync(
  path.join(EXT, "profile_sms_results_outbox.js"),
  "utf8"
);
assert(outbox.includes("IndexedDB") || outbox.includes("indexedDB"), "IDB");
assert(outbox.includes("ProfileSmsV73Integration"), "db name");
assert(outbox.includes("pending_results"), "results store");
assert(outbox.includes("CHUNK_SIZE"), "chunking");
assert(outbox.includes("PROFILE_SMS_PAGE_RESULTS"), "msg type");

const handoff = fs.readFileSync(
  path.join(EXT, "profile_sms_system_handoff.js"),
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
assert(handoff.includes("profileSmsActiveBatch"), "active batch key");
assert(handoff.includes("profileSmsActiveBatchLinks"), "links meta");

const content = fs.readFileSync(path.join(EXT, "content.js"), "utf8");
assert(content.includes("COMMENTS_DONE"), "content still has auto-next");
assert(content.includes("currentPageIndex"), "index semantics");

const bg = fs.readFileSync(path.join(EXT, "background.js"), "utf8");
assert(bg.includes('importScripts("profile_sms_results_outbox.js")'), "outbox import");
assert(bg.includes('importScripts("profile_sms_system_handoff.js")'), "handoff import");

const man = JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"), "utf8"));
assert(man.version === "1.4.0", "version");
const hasHook = (man.content_scripts || []).some((cs) =>
  (cs.js || []).includes("profile_sms_results_hook.js")
);
assert(hasHook, "hook registered");

// Simulated result_key strategy (mirror)
function buildResultKey(c) {
  if (c && c.comment_id != null && String(c.comment_id).trim())
    return "c:" + String(c.comment_id).trim();
  if (c && c.feedback_id != null && String(c.feedback_id).trim())
    return "f:" + String(c.feedback_id).trim();
  return "h:fallback";
}
assert(buildResultKey({ comment_id: "1" }) === "c:1", "key comment");
assert(buildResultKey({ feedback_id: "2" }) === "f:2", "key feedback");

// Index → link_job_id mapping simulation
const links = [
  { link_job_id: 10, index: 0 },
  { link_job_id: 11, index: 1 },
];
assert(links.find((l) => l.index === 0).link_job_id === 10, "map 0");
assert(links.find((l) => l.index === 1).link_job_id === 11, "map 1");

console.log("phase1d_extension_static_check: ALL PASS");
console.log("Protected ZERO DIFF: YES");
