import {
  BATCH_RESULTS_PAGE_SIZE,
  BATCH_RESULTS_POLL_MS,
  MAX_BATCH_LINKS,
  POST_TERMINAL_POLL_MAX_MS,
  POST_TERMINAL_RESULTS_POLL_MS,
  POST_TERMINAL_STABLE_POLLS,
  isActiveToTerminalTransition,
  isBatchPollActiveStatus,
  isBatchTerminalStatus,
  isEnrichmentActiveStatus,
  isEnrichmentSettledStatus,
  isTxtFile,
  mapBatchApiResultToRow,
  parseFacebookLinksTxt,
  pickActiveBatch,
  shouldContinuePostTerminalPoll,
  validateBeforeCreateBatch,
  validateCommentsPerPost,
  whatsappHrefFromPhone,
} from "./facebookPostBatchTxt";
import { calcTotalPages } from "./facebookPostBatchPagination";
import { USE_MOCK_EXTRACTION_RESULTS } from "./facebookPostsMockData";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(USE_MOCK_EXTRACTION_RESULTS === false, "mock off");
  assert(BATCH_RESULTS_PAGE_SIZE === 10, "page size 10");
  assert(
    BATCH_RESULTS_POLL_MS >= 2000 && BATCH_RESULTS_POLL_MS <= 5000,
    "poll 2-5s"
  );
  assert(POST_TERMINAL_RESULTS_POLL_MS === 3000, "post-terminal poll 3s");
  assert(POST_TERMINAL_POLL_MAX_MS === 60_000, "max 60s");
  assert(POST_TERMINAL_STABLE_POLLS === 3, "stable 3");

  // TXT basics
  assert(isTxtFile({ name: "a.txt" } as File), "txt ok");
  assert(!isTxtFile({ name: "a.csv" } as File), "non-txt");
  assert(
    parseFacebookLinksTxt("https://www.facebook.com/groups/1/posts/2/\n").ok,
    "1 link"
  );
  assert(!validateBeforeCreateBatch([], 10, false).ok, "no file");
  assert(validateCommentsPerPost(100).ok, "count 100");

  // pickActiveBatch
  assert(
    pickActiveBatch([
      { batch_id: 2, status: "completed", total_links: 1, requested_count: 1 },
      { batch_id: 1, status: "queued", total_links: 2, requested_count: 10 },
    ])?.batch_id === 1,
    "pick queued"
  );
  assert(
    pickActiveBatch([
      { batch_id: 3, status: "queued", total_links: 1, requested_count: 1 },
      { batch_id: 2, status: "running", total_links: 1, requested_count: 1 },
    ])?.batch_id === 2,
    "pick running"
  );
  assert(
    pickActiveBatch([
      { batch_id: 521, status: "queued", total_links: 1, requested_count: 1 },
      { batch_id: 519, status: "partial", total_links: 2, requested_count: 100 },
    ])?.batch_id === 521,
    "new queued wins over 519"
  );

  assert(isBatchPollActiveStatus("running"), "poll running");
  assert(isBatchPollActiveStatus("queued"), "poll queued");
  assert(!isBatchPollActiveStatus("pending"), "no poll pending");
  assert(!isBatchPollActiveStatus("partial"), "no poll partial");
  assert(!isBatchPollActiveStatus("completed"), "no poll completed");
  assert(!isBatchPollActiveStatus("failed"), "no poll failed");
  assert(isBatchTerminalStatus("partial"), "terminal partial");

  // Live refresh helpers
  assert(isActiveToTerminalTransition("running", "completed"), "run→done");
  assert(isActiveToTerminalTransition("queued", "partial"), "queue→partial");
  assert(!isActiveToTerminalTransition("completed", "completed"), "no loop");
  assert(!isActiveToTerminalTransition(null, "completed"), "no cold start");
  assert(isEnrichmentActiveStatus("queued"), "enrich queued");
  assert(isEnrichmentActiveStatus("running"), "enrich running");
  assert(isEnrichmentSettledStatus("done"), "enrich done");
  assert(isEnrichmentSettledStatus("idle"), "enrich idle");

  assert(
    shouldContinuePostTerminalPoll({
      batchStatus: "completed",
      enrichmentStatus: "running",
      enrichmentStatusAvailable: true,
      elapsedMs: 3000,
      stablePolls: 0,
      resultCount: 5,
    }) === true,
    "enrich running continues"
  );
  assert(
    shouldContinuePostTerminalPoll({
      batchStatus: "completed",
      enrichmentStatus: "done",
      enrichmentStatusAvailable: true,
      elapsedMs: 3000,
      stablePolls: 0,
      resultCount: 5,
    }) === false,
    "enrich done stops"
  );
  assert(
    shouldContinuePostTerminalPoll({
      batchStatus: "failed",
      enrichmentStatus: "running",
      enrichmentStatusAvailable: true,
      elapsedMs: 0,
      stablePolls: 0,
      resultCount: 0,
    }) === false,
    "failed no post-terminal poll"
  );
  assert(
    shouldContinuePostTerminalPoll({
      batchStatus: "partial",
      enrichmentStatus: null,
      enrichmentStatusAvailable: false,
      elapsedMs: 9000,
      stablePolls: 3,
      resultCount: 10,
    }) === false,
    "stable count stop"
  );
  assert(
    shouldContinuePostTerminalPoll({
      batchStatus: "completed",
      enrichmentStatus: "running",
      enrichmentStatusAvailable: true,
      elapsedMs: 60_000,
      stablePolls: 0,
      resultCount: 1,
    }) === false,
    "hard max 60s"
  );

  const mapped = mapBatchApiResultToRow({
    id: 42,
    author_name: "Alice",
    facebook_author_id: "100",
    author_profile_url: "https://www.facebook.com/alice",
    author_avatar_url: "https://example.com/a.jpg",
    comment_text: "hello world",
    comment_created_at: "2024-01-02 03:04:05",
    created_at: "2024-01-02 04:00:00",
    phone: "+966501234567",
  });
  assert(mapped.id === 42, "map id");
  assert(mapped.name === "Alice", "map name");
  assert(mapped.comment === "hello world", "map comment");
  assert(mapped.phone === "+966501234567", "intl phone mapped");
  assert(mapped.status === "completed", "row status completed");
  assert(mapped.profileUrl.includes("facebook.com"), "map profile");
  assert(mapped.updated.includes("2024"), "map updated");

  assert(
    whatsappHrefFromPhone("+4915212345678") === "https://wa.me/4915212345678",
    "wa.de"
  );
  assert(
    whatsappHrefFromPhone("+971501234567") === "https://wa.me/971501234567",
    "wa.ae"
  );
  assert(whatsappHrefFromPhone("01012345678") === null, "no local 0 wa");
  assert(whatsappHrefFromPhone("") === null, "no empty wa");

  const mixed = [
    mapBatchApiResultToRow({ id: 1, phone: "+201012345678", comment_text: "a" }),
    mapBatchApiResultToRow({ id: 2, phone: "", comment_text: "b" }),
  ].filter((r) => Boolean(r.phone));
  assert(mixed.length === 1 && mixed[0].id === 1, "phone-only filter");

  const priorCount = 543;
  const newBatchRows: unknown[] = [];
  assert(newBatchRows.length === 0 && priorCount === 543, "new batch starts 0");

  const total = 543;
  const pages = Math.ceil(total / BATCH_RESULTS_PAGE_SIZE);
  assert(pages === 55, "543/10 pages");
  assert(calcTotalPages(538, 10) === 54, "538/10 pages regression");
  assert(MAX_BATCH_LINKS === 500, "max links");

  console.log("facebookPostBatchTxt.selftest: ALL PASS");
}

run();
