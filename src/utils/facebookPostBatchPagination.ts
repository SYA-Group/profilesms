/** Client-side pagination helpers for Facebook batch extraction results. */

export const BATCH_RESULTS_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export type BatchResultsPageSize =
  (typeof BATCH_RESULTS_PAGE_SIZE_OPTIONS)[number];

/** totalPages = ceil(total / pageSize). No MAX_PAGES or other upper bound. */
export function calcTotalPages(total: number, pageSize: number): number {
  if (total <= 0) return 1;
  const size = Math.max(1, pageSize);
  return Math.max(1, Math.ceil(total / size));
}

/** True while Next should remain enabled (current page is not the last). */
export function canGoNextPage(page: number, totalPages: number): boolean {
  return page < totalPages;
}

/** Advance one page, clamped only to totalPages (not an arbitrary cap). */
export function nextPageIndex(page: number, totalPages: number): number {
  return Math.min(totalPages, page + 1);
}

/** Sliding window of page numbers (e.g. 25 26 27 28 29 30 31). */
export function getWindowedPageNumbers(
  currentPage: number,
  totalPages: number,
  windowSize = 7
): number[] {
  if (totalPages <= 0) return [];
  if (totalPages <= windowSize) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, currentPage - half);
  let end = start + windowSize - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - windowSize + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function slicePageRows<T>(
  rows: T[],
  page: number,
  pageSize: number
): T[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export function pageRange(
  total: number,
  page: number,
  pageSize: number
): { start: number; end: number } {
  if (total === 0) return { start: 0, end: 0 };
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return { start, end };
}
