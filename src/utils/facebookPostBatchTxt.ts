/**
 * Client-side TXT parse + validation for Facebook Post Batches (Phase 1B).
 * Aligns with backend MAX_BATCH_LINKS / is_valid_facebook_url rules.
 * Backend remains source of truth.
 */

export const MAX_BATCH_LINKS = 500;
export const MAX_TXT_BYTES = 5 * 1024 * 1024;
export const BATCH_RESULTS_PAGE_SIZE = 20;

const ALLOWED_FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "web.facebook.com",
  "m.facebook.com",
  "mbasic.facebook.com",
]);

/** Match backend routes.facebook_post_jobs.is_valid_facebook_url */
export function isValidFacebookBatchUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  let host = parsed.hostname.toLowerCase();
  if (host.includes("@")) {
    host = host.split("@").pop() || host;
  }
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    /^\d+(\.\d+){3}$/.test(host)
  ) {
    return false;
  }
  if (ALLOWED_FACEBOOK_HOSTS.has(host)) return true;
  if (host.endsWith(".facebook.com") && host.split(".").length >= 3) return true;
  return false;
}

export function isTxtFile(file: File): boolean {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".txt")) return true;
  const type = (file.type || "").toLowerCase();
  return type === "text/plain";
}

export type ParseTxtResult =
  | { ok: true; links: string[] }
  | { ok: false; error: string; links: [] };

/**
 * Parse TXT content: trim, skip empties, validate FB URLs, dedupe (keep first order).
 */
export function parseFacebookLinksTxt(content: string): ParseTxtResult {
  const lines = String(content ?? "").split(/\r?\n/);
  const cleaned: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const url = lines[i].trim();
    if (!url) continue;
    if (!isValidFacebookBatchUrl(url)) {
      return {
        ok: false,
        error: `The file contains an invalid Facebook URL. (line ${i + 1})`,
        links: [],
      };
    }
    if (seen.has(url)) continue;
    seen.add(url);
    cleaned.push(url);
  }

  if (cleaned.length === 0) {
    return {
      ok: false,
      error: "The file must contain at least one valid Facebook URL.",
      links: [],
    };
  }

  if (cleaned.length > MAX_BATCH_LINKS) {
    return {
      ok: false,
      error: `File exceeds maximum of ${MAX_BATCH_LINKS} links.`,
      links: [],
    };
  }

  return { ok: true, links: cleaned };
}

export type CommentsValidation =
  | { ok: true; requested_count: number }
  | { ok: false; error: string };

export function validateCommentsPerPost(
  raw: string | number
): CommentsValidation {
  if (raw === "" || raw === null || raw === undefined) {
    return { ok: false, error: "Number of Comments must be an integer greater than 0." };
  }
  const count =
    typeof raw === "number" ? raw : Number(String(raw).trim());
  if (Number.isNaN(count) || !Number.isInteger(count) || count <= 0) {
    return {
      ok: false,
      error: "Number of Comments must be an integer greater than 0.",
    };
  }
  return { ok: true, requested_count: count };
}

export type StartValidation =
  | { ok: true; links: string[]; requested_count: number }
  | { ok: false; error: string };

/** Full client gate before POST create-batch (no API call on failure). */
export function validateBeforeCreateBatch(
  links: string[] | null | undefined,
  commentsRaw: string | number,
  fileSelected: boolean
): StartValidation {
  if (!fileSelected) {
    return { ok: false, error: "Please select a .txt links file." };
  }
  if (!Array.isArray(links) || links.length === 0) {
    return {
      ok: false,
      error: "The file must contain at least one valid Facebook URL.",
    };
  }
  if (links.length > MAX_BATCH_LINKS) {
    return {
      ok: false,
      error: `File exceeds maximum of ${MAX_BATCH_LINKS} links.`,
    };
  }
  for (let i = 0; i < links.length; i++) {
    if (!isValidFacebookBatchUrl(links[i])) {
      return {
        ok: false,
        error: `The file contains an invalid Facebook URL. (link ${i + 1})`,
      };
    }
  }
  const comments = validateCommentsPerPost(commentsRaw);
  if (!comments.ok) return comments;
  return {
    ok: true,
    links: [...links],
    requested_count: comments.requested_count,
  };
}

export interface FacebookPostBatchSummary {
  batch_id: number;
  status: string;
  total_links: number;
  requested_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

/** Prefer running, else newest queued from list (newest-first from API). */
export function pickActiveBatch(
  batches: FacebookPostBatchSummary[]
): FacebookPostBatchSummary | null {
  if (!Array.isArray(batches) || batches.length === 0) return null;
  const running = batches.find((b) => b.status === "running");
  if (running) return running;
  const queued = batches.find((b) => b.status === "queued");
  if (queued) return queued;
  return null;
}
