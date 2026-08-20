/**
 * Client-side TXT parse + validation for Facebook Post Batches (Phase 1B).
 * Aligns with backend MAX_BATCH_LINKS / is_valid_facebook_url rules.
 * Backend remains source of truth.
 */

export const MAX_BATCH_LINKS = 500;
export const MAX_TXT_BYTES = 5 * 1024 * 1024;
export const BATCH_RESULTS_PAGE_SIZE = 10;
/** Live poll while batch is queued/running (read-only GETs). */
export const BATCH_RESULTS_POLL_MS = 3000;
/** Post-terminal phone_only refresh while enrichment may still finish. */
export const POST_TERMINAL_RESULTS_POLL_MS = 3000;
export const POST_TERMINAL_POLL_MAX_MS = 60_000;
export const POST_TERMINAL_STABLE_POLLS = 3;

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

const TERMINAL_BATCH_STATUSES = new Set([
  "partial",
  "completed",
  "failed",
]);

export function isBatchPollActiveStatus(status: string | null | undefined): boolean {
  const s = String(status || "").toLowerCase();
  return s === "running" || s === "queued";
}

export function isBatchTerminalStatus(status: string | null | undefined): boolean {
  return TERMINAL_BATCH_STATUSES.has(String(status || "").toLowerCase());
}

/** Phone enrichment row is still working (GET enrich-phones/status). */
export function isEnrichmentActiveStatus(
  status: string | null | undefined
): boolean {
  const s = String(status || "").toLowerCase();
  return s === "queued" || s === "running";
}

/** Enrichment finished or absent — safe to stop post-terminal polls. */
export function isEnrichmentSettledStatus(
  status: string | null | undefined
): boolean {
  const s = String(status || "").toLowerCase();
  return (
    s === "done" ||
    s === "failed" ||
    s === "error" ||
    s === "idle" ||
    s === ""
  );
}

/**
 * Whether post-terminal phone_only polling should continue.
 * Prefer enrichment status; fall back to stable phone_only count.
 */
export function shouldContinuePostTerminalPoll(opts: {
  batchStatus: string | null | undefined;
  enrichmentStatus: string | null | undefined;
  enrichmentStatusAvailable: boolean;
  elapsedMs: number;
  maxMs?: number;
  stablePolls: number;
  resultCount: number;
  stablePollsNeeded?: number;
}): boolean {
  const batch = String(opts.batchStatus || "").toLowerCase();
  if (batch === "failed") return false;
  if (!isBatchTerminalStatus(batch)) return false;
  const maxMs = opts.maxMs ?? POST_TERMINAL_POLL_MAX_MS;
  if (opts.elapsedMs >= maxMs) return false;

  if (opts.enrichmentStatusAvailable) {
    return isEnrichmentActiveStatus(opts.enrichmentStatus);
  }

  const needed = opts.stablePollsNeeded ?? POST_TERMINAL_STABLE_POLLS;
  if (opts.resultCount > 0 && opts.stablePolls >= needed) return false;
  return true;
}

/** Detect queued/running → terminal transition (forced final fetch). */
export function isActiveToTerminalTransition(
  prevStatus: string | null | undefined,
  nextStatus: string | null | undefined
): boolean {
  return (
    isBatchPollActiveStatus(prevStatus) && isBatchTerminalStatus(nextStatus)
  );
}

/**
 * Prefer running, else queued, else newest terminal
 * (partial / completed / failed). List is typically newest-first; tie-break by id.
 * Do not prefer stale "pending" over a newer/older terminal batch with real results.
 */
export function pickActiveBatch(
  batches: FacebookPostBatchSummary[]
): FacebookPostBatchSummary | null {
  if (!Array.isArray(batches) || batches.length === 0) return null;
  const running = batches.find((b) => b.status === "running");
  if (running) return running;
  const queued = batches.find((b) => b.status === "queued");
  if (queued) return queued;
  const terminals = batches.filter((b) => isBatchTerminalStatus(b.status));
  if (terminals.length > 0) {
    return [...terminals].sort((a, b) => b.batch_id - a.batch_id)[0];
  }
  // Last resort: newest non-empty status batch (e.g. orphan pending only)
  return [...batches].sort((a, b) => b.batch_id - a.batch_id)[0];
}

export function truncateProfileUrlDisplay(url: string, max = 48): string {
  const raw = String(url || "").trim();
  if (!raw) return "—";
  const stripped = raw.replace(/^https?:\/\/(www\.)?/i, "");
  if (stripped.length <= max) return stripped;
  return `${stripped.slice(0, max - 1)}…`;
}

/** Map durable backend result row → table row shape (Phase 1E phone when present). */
export function mapBatchApiResultToRow(r: {
  id?: number | string;
  author_name?: string | null;
  facebook_author_id?: string | null;
  author_profile_url?: string | null;
  author_avatar_url?: string | null;
  comment_text?: string | null;
  comment_created_at?: string | null;
  created_at?: string | null;
  phone?: string | null;
}): {
  id: number;
  name: string;
  profileUrl: string;
  profileUrlDisplay: string;
  avatarUrl: string;
  comment: string;
  phone: string;
  status: "completed";
  updated: string;
} {
  const profileUrl = String(r.author_profile_url || "").trim();
  const name =
    String(r.author_name || "").trim() ||
    String(r.facebook_author_id || "").trim() ||
    "Unknown";
  const phone = String(r.phone || "").trim();
  return {
    id: Number(r.id),
    name,
    profileUrl: profileUrl || "#",
    profileUrlDisplay: truncateProfileUrlDisplay(profileUrl),
    avatarUrl: String(r.author_avatar_url || "").trim(),
    comment: String(r.comment_text || ""),
    phone,
    status: "completed",
    updated: String(r.comment_created_at || r.created_at || ""),
  };
}

/** WhatsApp wa.me digits from E.164 / international phone (no +). */
export function whatsappDigitsFromPhone(phone: string): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  if (digits.startsWith("0")) return null;
  return digits;
}

export function whatsappHrefFromPhone(phone: string): string | null {
  const d = whatsappDigitsFromPhone(phone);
  return d ? `https://wa.me/${d}` : null;
}
