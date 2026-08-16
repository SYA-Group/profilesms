import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { ExternalLink, Facebook } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import {
  createFacebookPostJob,
  listFacebookPostJobs,
} from "../api";
import {
  FACEBOOK_POSTS_POLL_MS,
  formatJobDate,
  getJobStatusBadgeClass,
  isSafeFacebookPostUrl,
  validateFacebookPostForm,
} from "../utils/facebookPostsHelpers";
import type { FacebookPostJob } from "../utils/facebookPostsHelpers";

const FacebookPosts = () => {
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

  const listInFlight = useRef(false);
  const mounted = useRef(true);

  const loadJobs = useCallback(async (opts?: { silent?: boolean }) => {
    if (listInFlight.current) return;
    listInFlight.current = true;

    if (!opts?.silent) {
      setLoading(true);
    }

    try {
      const data = await listFacebookPostJobs();
      if (!mounted.current) return;
      setJobs(Array.isArray(data?.jobs) ? data.jobs : []);
      setListError(null);
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
          className={`px-6 py-4 border-b ${
            darkMode ? "border-slate-700" : "border-gray-200"
          }`}
        >
          <h2 className="text-xl font-semibold">Extraction Jobs</h2>
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
                    <td className="px-4 py-3 max-w-[240px]">
                      <span className="block truncate" title={job.post_url}>
                        {job.post_url}
                      </span>
                      {job.status === "failed" && job.error ? (
                        <span className="block mt-1 text-xs text-red-500 truncate" title={job.error}>
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
                      ) : (
                        <span className="opacity-50 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default FacebookPosts;
