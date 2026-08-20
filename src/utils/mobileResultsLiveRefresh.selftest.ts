/**
 * Phase MOBILE-RESULTS-LIVE-REFRESH — static + pure helper checks.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  BATCH_RESULTS_POLL_MS,
  POST_TERMINAL_POLL_MAX_MS,
  POST_TERMINAL_RESULTS_POLL_MS,
  isActiveToTerminalTransition,
  isBatchPollActiveStatus,
  isEnrichmentActiveStatus,
  shouldContinuePostTerminalPoll,
} from "./facebookPostBatchTxt.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiPath = path.join(__dirname, "..", "pages", "FacebookPostsBatchUI.tsx");

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function run() {
  const ui = fs.readFileSync(uiPath, "utf8");

  assert(BATCH_RESULTS_POLL_MS === 3000, "running poll 3s");
  assert(POST_TERMINAL_RESULTS_POLL_MS === 3000, "post-terminal 3s");
  assert(POST_TERMINAL_POLL_MAX_MS === 60_000, "max 60s");

  assert(isBatchPollActiveStatus("running"), "1 running poll");
  assert(isActiveToTerminalTransition("running", "completed"), "2 forced");
  assert(
    shouldContinuePostTerminalPoll({
      batchStatus: "completed",
      enrichmentStatus: "running",
      enrichmentStatusAvailable: true,
      elapsedMs: 1000,
      stablePolls: 0,
      resultCount: 0,
    }),
    "3 enrich continue"
  );
  assert(
    !shouldContinuePostTerminalPoll({
      batchStatus: "completed",
      enrichmentStatus: "done",
      enrichmentStatusAvailable: true,
      elapsedMs: 1000,
      stablePolls: 0,
      resultCount: 12,
    }),
    "4 enrich done stop"
  );

  assert(ui.includes('addEventListener("focus"'), "5 focus");
  assert(ui.includes('addEventListener("visibilitychange"'), "6 visibility");
  assert(ui.includes('addEventListener("pageshow"'), "7 pageshow");
  assert(ui.includes("refreshInFlightRef"), "8 in-flight");
  assert(ui.includes("isActiveToTerminalTransition"), "forced transition");
  assert(ui.includes("getFacebookPostBatchPhoneEnrichmentStatus"), "enrich GET");
  assert(ui.includes("phoneOnly: true"), "phone_only kept");
  assert(!ui.includes("startFacebookPostBatchPhoneEnrichment"), "no POST enrich");
  assert(ui.includes("POST_TERMINAL_POLL_MAX_MS"), "bounded");
  assert(ui.includes("safeRefreshActiveBatch"), "safe refresh");

  // Enrichment active helper
  assert(isEnrichmentActiveStatus("queued"), "enrich queued");

  console.log("mobileResultsLiveRefresh.selftest: ALL PASS");
}

run();
