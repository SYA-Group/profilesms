export type FacebookPostJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export interface FacebookPostJob {
  job_id: number;
  post_url: string;
  requested_count: number;
  status: FacebookPostJobStatus | string;
  comments_found: number;
  ids_found: number;
  error: string | null;
  retry_count: number;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface FacebookPostJobResult {
  id: number;
  job_id: number;
  facebook_comment_id: string | null;
  facebook_author_id: string;
  author_name: string | null;
  comment_text: string | null;
  comment_created_at: string | null;
  created_at: string | null;
}

export interface CreateFacebookPostJobInput {
  post_url: string;
  requested_count: number;
}

export interface FacebookPostFormValidation {
  ok: boolean;
  errors: { post_url?: string; requested_count?: string };
  payload?: CreateFacebookPostJobInput;
}

/** Client-side validation for the create-job form. */
export function validateFacebookPostForm(
  postUrl: string,
  requestedCountRaw: string | number
): FacebookPostFormValidation {
  const errors: { post_url?: string; requested_count?: string } = {};
  const url = String(postUrl || "").trim();

  if (!url) {
    errors.post_url = "Facebook Post URL is required.";
  }

  const count =
    typeof requestedCountRaw === "number"
      ? requestedCountRaw
      : Number(String(requestedCountRaw).trim());

  if (
    requestedCountRaw === "" ||
    requestedCountRaw === null ||
    requestedCountRaw === undefined ||
    Number.isNaN(count)
  ) {
    errors.requested_count = "Number of Comments is required.";
  } else if (!Number.isInteger(count) || count <= 0) {
    errors.requested_count = "Number of Comments must be an integer greater than 0.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: {},
    payload: { post_url: url, requested_count: count },
  };
}

/** Tailwind classes matching existing status pill patterns. */
export function getJobStatusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200";
    case "failed":
      return "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200";
    case "running":
      return "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200";
    case "pending":
    default:
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-200";
  }
}

/** Only allow opening known Facebook post hosts in a new tab. */
export function isSafeFacebookPostUrl(url: string): boolean {
  try {
    const u = new URL(String(url || "").trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return (
      host === "www.facebook.com" ||
      host === "facebook.com" ||
      host === "web.facebook.com" ||
      host === "m.facebook.com"
    );
  } catch {
    return false;
  }
}

export function formatJobDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

/** Display helper for result table cells (null → "-"). */
export function displayOrDash(value: string | null | undefined): string {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "-";
  }
  return String(value);
}

export const FACEBOOK_POSTS_POLL_MS = 5000;
