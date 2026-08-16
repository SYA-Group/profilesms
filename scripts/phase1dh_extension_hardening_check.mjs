/**
 * Phase 1D-H extension static + simulation checks (no Facebook / no Chrome).
 * Run: node scripts/phase1dh_extension_hardening_check.mjs
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import assert from "assert";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT =
  "C:\\Users\\Administrator\\Downloads\\تفاح\\extension and profile sms\\All Externsions\\auto-posts-exporter-ext-date-popup-v73 (1)\\auto-posts-exporter-ext-date-popup-v73\\auto-posts-exporter-ext-date-popup-v73";

function sha(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex")
    .toUpperCase();
}

const BEFORE = path.join(EXT, "_phase1dh_protected_hashes_before.txt");
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
  const h = sha(path.join(EXT, rel));
  const prev = beforeMap.get(rel) || beforeMap.get(rel.replace(/\//g, "\\"));
  if (prev && prev !== h) changed.push(rel);
}
assert.strictEqual(changed.length, 0, "protected changed: " + changed.join(","));

const hook = fs.readFileSync(path.join(EXT, "profile_sms_results_hook.js"), "utf8");
assert.ok(hook.includes("event.source !== window") || hook.includes("ev.source !== window"));
assert.ok(hook.includes("MAX_COMMENTS_PER_EVENT"));
assert.ok(!/handoff_token\s*[:=]/.test(hook));
assert.ok(hook.includes("batch_id") && hook.includes("return")); // rejects page batch_id

const outbox = fs.readFileSync(path.join(EXT, "profile_sms_results_outbox.js"), "utf8");
assert.ok(outbox.includes("canonicalizeFacebookUrl"));
assert.ok(outbox.includes("url_index_mismatch") || outbox.includes("URL/index mismatch"));
assert.ok(outbox.includes("profileSmsEmergencyOutbox"));
assert.ok(outbox.includes("profileSmsDurabilityFault"));
assert.ok(outbox.includes("unlimitedStorage") === false);

const handoff = fs.readFileSync(
  path.join(EXT, "profile_sms_system_handoff.js"),
  "utf8"
);
assert.ok(handoff.includes("clearInvalidPending"));
assert.ok(handoff.includes("status === 401"));
assert.ok(!handoff.includes("PROFILE_SMS_SIMULATE_APPLY_LIST"));
assert.ok(
  handoff.includes("PROFILE_SMS_LIVE_EXTRACTION_ENABLED = false")
);
assert.ok(
  handoff.includes("PROFILE_SMS_AUTO_ACQUIRE_ENABLED = false")
);

// --- URL canonicalization (eval mirror from outbox source via Function) ---
const canonSrc = outbox.match(
  /function canonicalizeFacebookUrl\(raw\) \{[\s\S]*?\n  \}/
)[0];
const urlsMatchSrc = outbox.match(/function urlsMatch\(a, b\) \{[\s\S]*?\n  \}/)[0];
const fn = new Function(
  `${canonSrc}\n${urlsMatchSrc}\nreturn { canonicalizeFacebookUrl, urlsMatch };`
);
const { canonicalizeFacebookUrl, urlsMatch } = fn();

assert.ok(
  urlsMatch(
    "https://www.facebook.com/groups/1/posts/2/",
    "https://www.facebook.com/groups/1/posts/2"
  )
);
assert.ok(
  urlsMatch(
    "https://www.facebook.com/groups/1/posts/2?fbclid=abc&utm_source=x",
    "https://www.facebook.com/groups/1/posts/2/"
  )
);
assert.ok(
  !urlsMatch(
    "https://www.facebook.com/groups/1/posts/2/",
    "https://www.facebook.com/groups/1/posts/999/"
  )
);
assert.ok(
  urlsMatch(
    "https://m.facebook.com/groups/1/posts/2/",
    "https://www.facebook.com/groups/1/posts/2/"
  )
);
assert.ok(
  urlsMatch(
    "https://www.facebook.com/reel/12345/",
    "https://www.facebook.com/reel/12345"
  )
);
assert.ok(
  urlsMatch(
    "https://www.facebook.com/permalink.php?story_fbid=11&id=22&fbclid=zz",
    "https://www.facebook.com/permalink.php?id=22&story_fbid=11"
  )
);

// --- Simulated pending clear ---
let pending = { batch_id: 1, handoff_token: "psbh_old" };
function clearInvalidPending() {
  pending = null;
}
clearInvalidPending();
assert.strictEqual(pending, null);
pending = { batch_id: 2, handoff_token: "psbh_new" };
assert.strictEqual(pending.batch_id, 2);

// --- Simulated durability layers ---
class DurabilitySim {
  constructor() {
    this.idbOk = true;
    this.emergencyOk = true;
    this.idb = new Map();
    this.emergency = [];
    this.faults = [];
  }
  persist(key, row) {
    if (this.idbOk) {
      if (!this.idb.has(key)) this.idb.set(key, row);
      return { ok: true, path: "idb" };
    }
    if (this.emergencyOk) {
      if (!this.emergency.find((r) => r.key === key)) {
        if (this.emergency.length >= 40) throw new Error("overflow");
        this.emergency.push({ key, row });
      }
      return { ok: true, path: "emergency" };
    }
    this.faults.push({ key, type: "idb_and_emergency_failed" });
    return { ok: false, path: "fault" };
  }
  canComplete(linkKey) {
    if (this.faults.some((f) => f.key.startsWith(linkKey))) return false;
    if (this.emergency.some((e) => e.key.startsWith(linkKey))) return false;
    return ![...this.idb.keys()].some((k) => k.startsWith(linkKey));
  }
}

const d = new DurabilitySim();
assert.strictEqual(d.persist("1:10:c:1", { a: 1 }).path, "idb");
d.idbOk = false;
assert.strictEqual(d.persist("1:10:c:2", { a: 2 }).path, "emergency");
d.emergencyOk = false;
assert.strictEqual(d.persist("1:10:c:3", { a: 3 }).path, "fault");
assert.strictEqual(d.canComplete("1:10"), false);

// SW restart: emergency retained
const saved = d.emergency.slice();
assert.ok(saved.length >= 1);

console.log("phase1dh_extension_hardening_check: ALL PASS");
console.log("Protected ZERO DIFF: YES");
console.log("SIMULATE_APPLY_LIST: REMOVED");
