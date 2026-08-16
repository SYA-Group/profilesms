/**
 * Self-contained assertions for Phase 1B TXT / validation helpers.
 * Run: npx tsx src/utils/facebookPostBatchTxt.selftest.ts
 */
import {
  MAX_BATCH_LINKS,
  MAX_TXT_BYTES,
  isTxtFile,
  parseFacebookLinksTxt,
  pickActiveBatch,
  validateBeforeCreateBatch,
  validateCommentsPerPost,
} from "./facebookPostBatchTxt";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function fb(i: number) {
  return `https://www.facebook.com/groups/123/posts/${100000 + i}/`;
}

function run() {
  // A/B/C/D — valid counts
  for (const n of [1, 20, 100, 500]) {
    const text = Array.from({ length: n }, (_, i) => fb(i)).join("\n");
    const r = parseFacebookLinksTxt(text);
    assert(r.ok && r.links.length === n, `${n}-link parse`);
  }

  // E — 501 reject
  {
    const text = Array.from({ length: 501 }, (_, i) => fb(i)).join("\n");
    const r = parseFacebookLinksTxt(text);
    assert(!r.ok && String(r.error).includes("500"), "501 reject");
    const gate = validateBeforeCreateBatch(
      Array.from({ length: 501 }, (_, i) => fb(i)),
      100,
      true
    );
    assert(!gate.ok, "501 gate reject before API");
  }

  // F — duplicates keep first order
  {
    const a = fb(1);
    const b = fb(2);
    const r = parseFacebookLinksTxt(`${a}\n${b}\n${a}`);
    assert(r.ok && r.links.length === 2 && r.links[0] === a && r.links[1] === b, "dedupe");
  }

  // G — empty lines
  {
    const r = parseFacebookLinksTxt(`\n${fb(1)}\n\n${fb(2)}\n`);
    assert(r.ok && r.links.length === 2, "empty lines");
  }

  // H — invalid URL
  {
    const r = parseFacebookLinksTxt(`${fb(1)}\nhttps://example.com/x`);
    assert(!r.ok && r.error.includes("invalid Facebook URL"), "invalid url");
    const gate = validateBeforeCreateBatch([fb(1), "https://example.com/x"], 10, true);
    assert(!gate.ok, "invalid gate");
  }

  // I — non-txt
  {
    const fake = { name: "links.csv", type: "text/csv", size: 10 } as File;
    assert(!isTxtFile(fake), "non-txt");
    assert(isTxtFile({ name: "a.txt", type: "", size: 1 } as File), "txt ok");
  }

  // J — 5MB constant
  assert(MAX_TXT_BYTES === 5 * 1024 * 1024, "5MB");

  // K/L — comments
  assert(!validateCommentsPerPost(0).ok, "count 0");
  assert(!validateCommentsPerPost(-5).ok, "count neg");
  assert(!validateCommentsPerPost("abc").ok, "count nan");
  assert(validateCommentsPerPost(100).ok, "count 100");

  // Start without file
  assert(!validateBeforeCreateBatch([], 10, false).ok, "no file");

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
  assert(MAX_BATCH_LINKS === 500, "max links");

  console.log("facebookPostBatchTxt.selftest: ALL PASS");
}

run();
