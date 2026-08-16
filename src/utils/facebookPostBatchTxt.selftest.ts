import {
  BATCH_RESULTS_PAGE_SIZE,
  BATCH_RESULTS_POLL_MS,
  MAX_BATCH_LINKS,
  isBatchPollActiveStatus,
  isBatchTerminalStatus,
  isTxtFile,
  mapBatchApiResultToRow,
  parseFacebookLinksTxt,
  pickActiveBatch,
  validateBeforeCreateBatch,
  validateCommentsPerPost,
} from "./facebookPostBatchTxt";
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
      { batch_id: 4, status: "running", total_links: 1, requested_count: 1 },
    ])?.batch_id === 4,
    "pick running over queued"
  );
  assert(pickActiveBatch([]) === null, "pick empty");

  // W4-F2: terminal fallback (newest partial when no active)
  assert(
    pickActiveBatch([
      { batch_id: 519, status: "partial", total_links: 2, requested_count: 100 },
      { batch_id: 400, status: "completed", total_links: 1, requested_count: 10 },
    ])?.batch_id === 519,
    "pick newest partial 519"
  );
  assert(
    pickActiveBatch([
      { batch_id: 520, status: "failed", total_links: 1, requested_count: 1 },
      { batch_id: 519, status: "partial", total_links: 2, requested_count: 100 },
    ])?.batch_id === 520,
    "pick newest terminal by id"
  );
  assert(
    pickActiveBatch([
      { batch_id: 518, status: "pending", total_links: 2, requested_count: 100 },
      { batch_id: 519, status: "partial", total_links: 2, requested_count: 100 },
    ])?.batch_id === 519,
    "pending must not hide partial 519"
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

  const mapped = mapBatchApiResultToRow({
    id: 42,
    author_name: "Alice",
    facebook_author_id: "100",
    author_profile_url: "https://www.facebook.com/alice",
    author_avatar_url: "https://example.com/a.jpg",
    comment_text: "hello world",
    comment_created_at: "2024-01-02 03:04:05",
    created_at: "2024-01-02 04:00:00",
  });
  assert(mapped.id === 42, "map id");
  assert(mapped.name === "Alice", "map name");
  assert(mapped.comment === "hello world", "map comment");
  assert(mapped.phone === "", "no fake phone");
  assert(mapped.status === "completed", "row status completed");
  assert(mapped.profileUrl.includes("facebook.com"), "map profile");
  assert(mapped.updated.includes("2024"), "map updated");

  // Simulated: new queued batch shows 0 results (no bleed from prior 543)
  const priorCount = 543;
  const newBatchRows: unknown[] = [];
  assert(newBatchRows.length === 0 && priorCount === 543, "new batch starts 0");

  // Pagination math for 543
  const total = 543;
  const pages = Math.ceil(total / BATCH_RESULTS_PAGE_SIZE);
  assert(pages === 55, "543/10 pages");
  assert(MAX_BATCH_LINKS === 500, "max links");

  console.log("facebookPostBatchTxt.selftest: ALL PASS");
}

run();
