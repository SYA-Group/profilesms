import {
  calcTotalPages,
  canGoNextPage,
  getWindowedPageNumbers,
  nextPageIndex,
  pageRange,
  slicePageRows,
} from "./facebookPostBatchPagination";
import { BATCH_RESULTS_PAGE_SIZE } from "./facebookPostBatchTxt";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${expected}, got ${actual}`);
  }
}

/** Simulate repeated Next clicks until the last page; must reach totalPages with no hidden cap. */
function simulateNextUntilLast(
  totalResults: number,
  pageSize: number
): { totalPages: number; finalPage: number } {
  const totalPages = calcTotalPages(totalResults, pageSize);
  let page = 1;
  while (canGoNextPage(page, totalPages)) {
    page = nextPageIndex(page, totalPages);
  }
  return { totalPages, finalPage: page };
}

function run() {
  // Mandatory examples — pure ceil(total / pageSize), no cap
  assertEq(calcTotalPages(538, 10), 54, "538/10");
  assertEq(calcTotalPages(1000, 10), 100, "1000/10");
  assertEq(calcTotalPages(5000, 10), 500, "5000/10");
  assertEq(calcTotalPages(20000, 10), 2000, "20000/10");

  assertEq(calcTotalPages(538, 20), 27, "538/20");
  assertEq(calcTotalPages(538, 50), 11, "538/50");
  assertEq(calcTotalPages(538, 100), 6, "538/100");
  assertEq(calcTotalPages(0, 10), 1, "empty total = 1 page min");

  // Windowed pagination around current page (display window only — not a page limit)
  const w28 = getWindowedPageNumbers(28, 54, 7);
  assert(w28.length === 7, "window size 7 at page 28");
  assert(w28[0] === 25 && w28[6] === 31, "window centered on 28");
  assert(w28.includes(28), "window includes current page");

  const w100 = getWindowedPageNumbers(100, 2000, 7);
  assertEq(w100.join(" "), "97 98 99 100 101 102 103", "window at page 100 of 2000");

  const w54 = getWindowedPageNumbers(54, 54, 7);
  assert(w54[0] === 48 && w54[w54.length - 1] === 54, "last page window");

  const w2000 = getWindowedPageNumbers(2000, 2000, 7);
  assertEq(w2000[0], 1994, "window at last page of 2000");
  assertEq(w2000[w2000.length - 1], 2000, "window ends at totalPages");

  assert(
    getWindowedPageNumbers(29, 54, 7).includes(29),
    "page 29 reachable in window after 28"
  );

  // Row slicing — last pages for large result sets
  const rows538 = Array.from({ length: 538 }, (_, i) => i + 1);
  const p54 = slicePageRows(rows538, 54, 10);
  assert(p54.length === 8, "page 54 has 8 rows");
  assert(p54[0] === 531 && p54[7] === 538, "page 54 range");

  const r54 = pageRange(538, 54, 10);
  assert(r54.start === 531 && r54.end === 538, "page 54 label range");

  const rows20k = Array.from({ length: 20000 }, (_, i) => i + 1);
  const p2000 = slicePageRows(rows20k, 2000, 10);
  assertEq(p2000.length, 10, "page 2000 row count");
  assertEq(p2000[0], 19991, "page 2000 first row");
  assertEq(p2000[9], 20000, "page 2000 last row");

  // Next must work until page === totalPages (no hidden ceiling)
  for (const total of [538, 1000, 5000, 20000]) {
    const { totalPages, finalPage } = simulateNextUntilLast(total, 10);
    assertEq(
      finalPage,
      totalPages,
      `Next reaches last page for ${total} results (${totalPages} pages)`
    );
    assert(!canGoNextPage(finalPage, totalPages), `Next disabled at page ${finalPage}`);
  }

  assert(canGoNextPage(53, 54), "Next enabled before last page");
  assert(!canGoNextPage(54, 54), "Next disabled on last page");
  assertEq(nextPageIndex(53, 54), 54, "Next from 53 goes to 54");
  assertEq(nextPageIndex(54, 54), 54, "Next on last page stays at 54");

  assertEq(BATCH_RESULTS_PAGE_SIZE, 10, "default page size constant");

  console.log("facebookPostBatchPagination.selftest: ALL PASS");
}

run();
