import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  ExternalLink,
  Eye,
  Facebook,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import {
  bulkDeleteFacebookPostJobs,
  createFacebookPostJob,
  getFacebookPostJobResults,
  listFacebookPostJobs,
} from "../api";
import {
  FACEBOOK_POSTS_POLL_MS,
  displayOrDash,
  formatJobDate,
  getJobStatusBadgeClass,
  isSafeFacebookPostUrl,
  validateFacebookPostForm,
} from "../utils/facebookPostsHelpers";
import type {
  FacebookPostJob,
  FacebookPostJobResult,
} from "../utils/facebookPostsHelpers";
import FacebookPostsBatchUI from "./FacebookPostsBatchUI";

/* ------------------------------------------------------------------ */
/* Live / legacy single-URL jobs UI (preserved; not default in 1B)     */
/* ------------------------------------------------------------------ */

function FacebookPostsLive() {
  const { darkMode } = useTheme();

  const [postUrl, setPostUrl] = useState("");
  const [requestedCount, setRequestedCount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    post_url?: string;
    requested_count?: string;
  }>({});

  const [jobs, setJobs] = useState<FacebookPostJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedJob, setSelectedJob] = useState<FacebookPostJob | null>(null);
  const [results, setResults] = useState<FacebookPostJobResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);

  const [selectedJobIds, setSelectedJobIds] = useState<Set<number>>(
    () => new Set()
  );
  const [deleting, setDeleting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const listInFlight = useRef(false);
  const resultsInFlight = useRef(false);
  const mounted = useRef(true);
  const selectedJobIdRef = useRef<number | null>(null);

  const loadJobs = useCallback(async (opts?: { silent?: boolean }) => {
    if (listInFlight.current) return;
    listInFlight.current = true;

    if (!opts?.silent) {
      setLoading(true);
    }

    try {
      const data = await listFacebookPostJobs();
      if (!mounted.current) return;
      const nextJobs: FacebookPostJob[] = Array.isArray(data?.jobs)
        ? data.jobs
        : [];
      setJobs(nextJobs);
      setListError(null);

      setSelectedJobIds((prev) => {
        if (prev.size === 0) return prev;
        const visible = new Set(nextJobs.map((j) => j.job_id));
        let changed = false;
        const next = new Set<number>();
        prev.forEach((id) => {
          if (visible.has(id)) next.add(id);
          else changed = true;
        });
        return changed ? next : prev;
      });

      if (selectedJobIdRef.current != null) {
        const fresh = nextJobs.find(
          (j) => j.job_id === selectedJobIdRef.current
        );
        if (fresh) setSelectedJob(fresh);
      }
    } catch {
      if (!mounted.current) return;
      setListError("Could not load extraction jobs.");
      if (!opts?.silent) {
        setJobs([]);
      }
    } finally {
      listInFlight.current = false;
      if (mounted.current && !opts?.silent) {
        setLoading(false);
      }
    }
  }, []);

  const loadResults = useCallback(
    async (jobId: number, opts?: { silent?: boolean }) => {
      if (resultsInFlight.current) return;
      resultsInFlight.current = true;
      if (!opts?.silent) {
        setResultsLoading(true);
        setResultsError(null);
      }
      try {
        const data = await getFacebookPostJobResults(jobId);
        if (!mounted.current || selectedJobIdRef.current !== jobId) return;
        setResults(Array.isArray(data?.results) ? data.results : []);
        setResultsError(null);
      } catch {
        if (!mounted.current || selectedJobIdRef.current !== jobId) return;
        setResultsError("Could not load job results.");
        if (!opts?.silent) {
          setResults([]);
        }
      } finally {
        resultsInFlight.current = false;
        if (mounted.current && !opts?.silent) {
          setResultsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    mounted.current = true;
    loadJobs();

    const timer = window.setInterval(() => {
      loadJobs({ silent: true });
    }, FACEBOOK_POSTS_POLL_MS);

    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [loadJobs]);

  useEffect(() => {
    if (!selectedJob) return;
    const jobId = selectedJob.job_id;
    selectedJobIdRef.current = jobId;
    loadResults(jobId);

    if (selectedJob.status !== "running") {
      return;
    }

    const timer = window.setInterval(() => {
      loadResults(jobId, { silent: true });
    }, FACEBOOK_POSTS_POLL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [selectedJob?.job_id, selectedJob?.status, loadResults]);

  const openResults = (job: FacebookPostJob) => {
    selectedJobIdRef.current = job.job_id;
    setSelectedJob(job);
    setResults([]);
    setResultsError(null);
  };

  const closeResults = () => {
    selectedJobIdRef.current = null;
    setSelectedJob(null);
    setResults([]);
    setResultsError(null);
    setResultsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateFacebookPostForm(postUrl, requestedCount);
    setFieldErrors(result.errors);
    if (!result.ok || !result.payload) return;

    setSubmitting(true);
    try {
      await createFacebookPostJob(result.payload);
      toast.success("Extraction job created successfully.");
      setPostUrl("");
      setRequestedCount("");
      setFieldErrors({});
      await loadJobs();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to create extraction job.";
      toast.error(String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const cardClass = darkMode
    ? "bg-slate-800 border-slate-700"
    : "bg-white border-gray-200";
  const inputClass = `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
    darkMode
      ? "bg-slate-900 border-slate-600 text-gray-100"
      : "bg-white border-gray-300 text-gray-900"
  }`;

  const savedCount = results.length;
  const showIdGapNote =
    !!selectedJob &&
    Number(selectedJob.comments_found || 0) > savedCount &&
    selectedJob.status !== "pending";

  const visibleJobIds = useMemo(() => jobs.map((j) => j.job_id), [jobs]);
  const selectedCount = useMemo(() => {
    let n = 0;
    visibleJobIds.forEach((id) => {
      if (selectedJobIds.has(id)) n += 1;
    });
    return n;
  }, [visibleJobIds, selectedJobIds]);
  const allVisibleSelected =
    visibleJobIds.length > 0 && selectedCount === visibleJobIds.length;
  const someVisibleSelected =
    selectedCount > 0 && selectedCount < visibleJobIds.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  const toggleJobSelected = (jobId: number) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleJobIds.forEach((id) => next.delete(id));
      } else {
        visibleJobIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = visibleJobIds.filter((id) => selectedJobIds.has(id));
    if (ids.length === 0 || deleting) return;

    const ok = window.confirm(
      `Are you sure you want to permanently delete ${ids.length} extraction job(s)?`
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const data = await bulkDeleteFacebookPostJobs(ids);
      const deleted = Number(data?.deleted_jobs || 0);
      const skipped = Array.isArray(data?.skipped_running)
        ? data.skipped_running
        : [];

      await loadJobs();
      setSelectedJobIds(new Set());

      if (deleted > 0) {
        toast.success(
          `Deleted ${deleted} extraction job(s)${
            Number(data?.deleted_results || 0) > 0
              ? ` and ${data.deleted_results} result row(s)`
              : ""
          }.`
        );
      }
      if (skipped.length > 0) {
        toast.error(
          `Skipped ${skipped.length} running job(s) (not deleted): ${skipped.join(
            ", "
          )}`
        );
      } else if (deleted === 0) {
        toast.success("No matching jobs were deleted.");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to delete selected extraction jobs.";
      toast.error(String(msg));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className={`min-h-screen px-6 sm:px-10 py-10 transition-all duration-300 ${
        darkMode ? "bg-[#0f172a] text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      <motion.h1
        className="text-3xl sm:text-4xl font-bold mb-8 text-center tracking-tight flex items-center justify-center gap-3"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Facebook size={32} className="text-blue-600 dark:text-blue-400" />
        Facebook Posts
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl shadow-lg border p-6 mb-8 max-w-3xl mx-auto ${cardClass}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Facebook Post URL
            </label>
            <input
              type="text"
              value={postUrl}
              onChange={(e) => {
                setPostUrl(e.target.value);
                setFieldErrors((prev) => ({ ...prev, post_url: undefined }));
              }}
              placeholder="https://www.facebook.com/..."
              className={inputClass}
              disabled={submitting}
            />
            {fieldErrors.post_url && (
              <p className="mt-1 text-sm text-red-500">{fieldErrors.post_url}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Number of Comments
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={requestedCount}
              onChange={(e) => {
                setRequestedCount(e.target.value);
                setFieldErrors((prev) => ({
                  ...prev,
                  requested_count: undefined,
                }));
              }}
              placeholder="e.g. 100"
              className={`${inputClass} max-w-xs`}
              disabled={submitting}
            />
            {fieldErrors.requested_count && (
              <p className="mt-1 text-sm text-red-500">
                {fieldErrors.requested_count}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {submitting ? "Starting..." : "Start Extraction"}
          </button>
        </form>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={`rounded-2xl shadow-lg border overflow-hidden max-w-6xl mx-auto ${cardClass}`}
      >
        <div
          className={`px-6 py-4 border-b flex flex-wrap items-center justify-between gap-3 ${
            darkMode ? "border-slate-700" : "border-gray-200"
          }`}
        >
          <h2 className="text-xl font-semibold">Extraction Jobs</h2>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={selectedCount === 0 || deleting || loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Trash2 size={16} />
            {deleting
              ? "Deleting..."
              : selectedCount > 0
                ? `Delete Selected (${selectedCount})`
                : "Delete Selected"}
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-center opacity-70">Loading...</div>
        ) : listError ? (
          <div className="p-6 text-center text-red-500">{listError}</div>
        ) : jobs.length === 0 ? (
          <div className="p-6 text-center opacity-70">
            No Facebook post extraction jobs yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className={`w-full text-sm ${
                darkMode ? "text-gray-100" : "text-gray-800"
              }`}
            >
              <thead className={darkMode ? "bg-slate-900" : "bg-gray-100"}>
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all extraction jobs"
                      className="h-4 w-4 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">Post URL</th>
                  <th className="px-4 py-3 text-left">Requested</th>
                  <th className="px-4 py-3 text-left">Comments Found</th>
                  <th className="px-4 py-3 text-left">IDs Found</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Created At</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody
                className={`divide-y ${
                  darkMode ? "divide-slate-700" : "divide-gray-200"
                }`}
              >
                {jobs.map((job) => (
                  <tr key={job.job_id}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedJobIds.has(job.job_id)}
                        onChange={() => toggleJobSelected(job.job_id)}
                        aria-label={`Select job ${job.job_id}`}
                        className="h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 max-w-[240px]">
                      <span className="block truncate" title={job.post_url}>
                        {job.post_url}
                      </span>
                      {job.status === "failed" && job.error ? (
                        <span
                          className="block mt-1 text-xs text-red-500 truncate"
                          title={job.error}
                        >
                          {job.error}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{job.requested_count}</td>
                    <td className="px-4 py-3">{job.comments_found}</td>
                    <td className="px-4 py-3">{job.ids_found}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold capitalize ${getJobStatusBadgeClass(
                          job.status
                        )}`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatJobDate(job.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openResults(job)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          <Eye size={14} />
                          View Results
                        </button>
                        {isSafeFacebookPostUrl(job.post_url) ? (
                          <a
                            href={job.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
                          >
                            <ExternalLink size={14} />
                            Open Post
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {selectedJob && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50 p-4">
          <div
            className={`w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl shadow-xl border flex flex-col ${cardClass}`}
          >
            <div
              className={`px-5 py-4 border-b flex items-start justify-between gap-3 ${
                darkMode ? "border-slate-700" : "border-gray-200"
              }`}
            >
              <div>
                <h3 className="text-lg font-semibold">Job Results</h3>
                <p className="text-xs opacity-70 mt-1 break-all">
                  {selectedJob.post_url}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedJob.status === "running" && (
                  <button
                    type="button"
                    onClick={() =>
                      loadResults(selectedJob.job_id, { silent: false })
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <RefreshCw size={14} />
                    Refresh
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeResults}
                  className="p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
                <div>
                  <div className="opacity-60 text-xs">Requested</div>
                  <div className="font-semibold">
                    {selectedJob.requested_count}
                  </div>
                </div>
                <div>
                  <div className="opacity-60 text-xs">Comments Found</div>
                  <div className="font-semibold">
                    {selectedJob.comments_found}
                  </div>
                </div>
                <div>
                  <div className="opacity-60 text-xs">IDs Found</div>
                  <div className="font-semibold">{selectedJob.ids_found}</div>
                </div>
                <div>
                  <div className="opacity-60 text-xs">Saved Results</div>
                  <div className="font-semibold">{savedCount}</div>
                </div>
                <div>
                  <div className="opacity-60 text-xs">Status</div>
                  <span
                    className={`inline-block mt-0.5 px-2 py-1 rounded-full text-xs font-semibold capitalize ${getJobStatusBadgeClass(
                      selectedJob.status
                    )}`}
                  >
                    {selectedJob.status}
                  </span>
                </div>
              </div>

              {selectedJob.status === "pending" && (
                <p className="text-sm opacity-70">
                  Extraction has not started yet. Results will appear after the
                  job begins running.
                </p>
              )}

              {showIdGapNote && (
                <p className="text-sm text-amber-600 dark:text-amber-300">
                  Some extracted comments may not have a Facebook author ID and
                  therefore are not listed in the results table.
                </p>
              )}

              {resultsLoading ? (
                <div className="p-8 text-center opacity-70">
                  Loading extracted comments...
                </div>
              ) : resultsError ? (
                <div className="p-8 text-center text-red-500">{resultsError}</div>
              ) : results.length === 0 ? (
                <div className="p-8 text-center opacity-70">
                  No extracted results available yet.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
                  <table
                    className={`w-full text-sm ${
                      darkMode ? "text-gray-100" : "text-gray-800"
                    }`}
                  >
                    <thead className={darkMode ? "bg-slate-900" : "bg-gray-100"}>
                      <tr>
                        <th className="px-4 py-3 text-left whitespace-nowrap">
                          Facebook ID
                        </th>
                        <th className="px-4 py-3 text-left">Author</th>
                        <th className="px-4 py-3 text-left">Comment</th>
                        <th className="px-4 py-3 text-left whitespace-nowrap">
                          Comment At
                        </th>
                      </tr>
                    </thead>
                    <tbody
                      className={`divide-y ${
                        darkMode ? "divide-slate-700" : "divide-gray-200"
                      }`}
                    >
                      {results.map((row) => (
                        <tr key={row.id}>
                          <td className="px-4 py-3 font-mono text-xs break-all align-top">
                            {row.facebook_author_id}
                          </td>
                          <td className="px-4 py-3 align-top whitespace-nowrap">
                            {displayOrDash(row.author_name)}
                          </td>
                          <td className="px-4 py-3 align-top whitespace-pre-wrap break-words min-w-[220px] max-w-[480px]">
                            {displayOrDash(row.comment_text)}
                          </td>
                          <td className="px-4 py-3 align-top whitespace-nowrap">
                            {row.comment_created_at
                              ? formatJobDate(row.comment_created_at)
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Phase 1B default: real TXT upload + queued Batch UI (same visual design). */
const FacebookPosts = () => <FacebookPostsBatchUI />;

export default FacebookPosts;
/** Preserved legacy single-URL jobs screen (not mounted by default). */
export { FacebookPostsLive };
