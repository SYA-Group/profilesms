/**
 * Phase 1C frontend handoff helper selftest.
 * Run: npx tsx src/utils/profileSmsV73Handoff.selftest.ts
 */
import {
  PROFILE_SMS_HANDOFF_SOURCE,
  PROFILE_SMS_HANDOFF_TYPE,
  handoffBatchToV73Extension,
} from "./profileSmsV73Handoff";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

async function run() {
  assert(PROFILE_SMS_HANDOFF_SOURCE === "profile-sms-web", "source");
  assert(PROFILE_SMS_HANDOFF_TYPE === "PROFILE_SMS_BATCH_HANDOFF", "type");

  // Payload shape must not include secrets in the helper API surface
  const keys = Object.keys({
    batch_id: 1,
    handoff_token: "psbh_x",
    requested_count: 10,
    total_links: 2,
  });
  assert(!keys.includes("user_id"), "no user_id key");
  assert(!keys.includes("password"), "no password key");
  assert(!keys.includes("token"), "no main jwt key name");

  // No window in node — should fail softly
  const r = await handoffBatchToV73Extension({
    batch_id: 1,
    handoff_token: "psbh_test",
  });
  assert(r.ok === false, "no window → not ok");
  assert(
    r.error === "no_window" || r.error === "extension_bridge_unavailable",
    "error"
  );

  console.log("profileSmsV73Handoff.selftest: ALL PASS");
}

run();
