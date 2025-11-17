import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getDashboardStats, resendMessages ,  getUserInfo} from "../api";
import StatsCard from "../components/StatsCard";
import ExpandableRow from "../components/ExpandableRow";
import { useTheme } from "../context/ThemeContext";
import toast from "react-hot-toast";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import "../index.css";
import "modern-normalize/modern-normalize.css";

interface DashboardStats {
  summary: {
    contacts_total: number;
    sent: number;
    failed: number;
    pending: number;
    remaining_quota?: number; // ✅ support future backend
  };
  recent_messages: {
    phone: string;
    status: string;
    created_at: string;
  }[];
}

const PAGE_SIZE = 5;

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleMessages, setVisibleMessages] = useState<
    DashboardStats["recent_messages"]
  >([]);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<
    "all" | "sent" | "pending" | "failed"
  >("all");
  const { darkMode } = useTheme();

  const [showConfirm, setShowConfirm] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [userInfo, setUserInfo] = useState<{ 
    total_quota: number; 
    sent_quota: number; 
    remaining_quota?: number;
  } | null>(null);

    // ✅ Accurate quota detection using user info API

// Load user quota once
useEffect(() => {
  const loadUserQuota = async () => {
    try {
      const res = await getUserInfo();
      setUserInfo(res);
    } catch (err) {
      console.warn("⚠️ Could not load user quota:", err);
    }
  };
  loadUserQuota();
}, []);

  // ✅ Load stats
  const loadStats = async (forceRefresh = false) => {
    try {
      setError(null);
      const cached = sessionStorage.getItem("dashboard_cache");

      if (!forceRefresh && cached) {
        try {
          const cachedData: DashboardStats = JSON.parse(cached);
          setStats(cachedData);
          applyPagination(cachedData, 1, filterStatus);
          setLoading(false);
        } catch {
          sessionStorage.removeItem("dashboard_cache");
        }
      }

      const data = await getDashboardStats();
      if (
        !data ||
        typeof data !== "object" ||
        !data.summary ||
        !Array.isArray(data.recent_messages)
      ) {
        throw new Error("Invalid or empty data");
      }

      setStats(data);
      sessionStorage.setItem(
        "dashboard_cache",
        JSON.stringify({
          summary: data.summary,
          recent_messages: data.recent_messages.slice(0, 100),
        })
      );
      applyPagination(data, 1, filterStatus);
    } catch (err) {
      console.error("Failed to load stats:", err);
      setError("⚠️ Server is offline. Displaying cached/empty dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const applyPagination = (
    data: DashboardStats,
    pageNumber: number,
    filter: string
  ) => {
    const filtered = data.recent_messages
      .filter(
        (msg) => filter === "all" || msg.status.toLowerCase() === filter
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

    const start = (pageNumber - 1) * PAGE_SIZE;
    const paginated = filtered.slice(start, start + PAGE_SIZE);
    setVisibleMessages(paginated);
    setPage(pageNumber);
  };

  const handleResendAll = async () => {
    setIsResending(true);
    try {
      setShowConfirm(false);
      const res = await resendMessages("all");
      toast.success(res.message || "Resend started for all contacts!");
      loadStats(true);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to resend messages.");
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(() => loadStats(true), 10000);
    return () => clearInterval(interval);
  }, [filterStatus]);

  if (loading && !stats) {
    return (
      <div
        className={`flex items-center justify-center h-screen text-lg sm:text-xl font-medium ${
          darkMode ? "text-gray-300 bg-[#0f172a]" : "text-gray-600 bg-gray-50"
        }`}
      >
        Loading dashboard...
      </div>
    );
  }

  const { summary } = stats || {
    summary: { contacts_total: 0, sent: 0, failed: 0, pending: 0, remaining_quota: 1 },
  };

  const totalFiltered =
    stats?.recent_messages.filter(
      (msg) =>
        filterStatus === "all" || msg.status.toLowerCase() === filterStatus
    ).length || 0;
  const totalPages = Math.ceil(totalFiltered / PAGE_SIZE);



// Compute remaining accurately
const remainingQuota = userInfo?.remaining_quota ?? 
  (userInfo ? userInfo.total_quota - userInfo.sent_quota : 1);

const quotaFinished = remainingQuota <= 0;


  return (
    <div
      className={`min-h-screen px-6 sm:px-8 lg:px-12 py-8 transition-all duration-300 ${
        darkMode ? "bg-[#0f172a] text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* Header */}
      <motion.h1
        className={`text-3xl sm:text-4xl font-bold mb-8 text-center tracking-tight ${
          darkMode ? "text-white" : "text-gray-800"
        }`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Dashboard Overview
      </motion.h1>

      {/* === Summary Cards === */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <StatsCard
          title="Total Contacts"
          value={summary.contacts_total}
          color="bg-blue-600/80 hover:bg-blue-700"
          icon="users"
        />
        <StatsCard
          title="Messages Sent"
          value={summary.sent}
          color="bg-green-600/80 hover:bg-green-700"
          icon="send"
          onClick={() => setFilterStatus("sent")}
        />
        <StatsCard
          title="Failed Messages"
          value={summary.failed}
          color="bg-red-600/80 hover:bg-red-700"
          icon="alert-triangle"
          onClick={() => setFilterStatus("failed")}
        />
        <StatsCard
          title="Pending Messages"
          value={summary.pending}
          color="bg-yellow-600/80 hover:bg-yellow-700"
          icon="clock"
          onClick={() => setFilterStatus("pending")}
        />
        <StatsCard
          title="Resend All"
          value={summary.contacts_total}
          color="bg-purple-600/80 hover:bg-purple-700"
          icon="send"
          onClick={() => setShowConfirm(true)}
        />
      </motion.div>

      {/* === Quota Finished View === */}
      {quotaFinished ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className={`flex flex-col items-center justify-center text-center rounded-2xl shadow-xl p-10 border ${
            darkMode
              ? "bg-slate-800 border-red-700 text-red-300"
              : "bg-white border-red-300 text-red-700"
          }`}
        >
          <motion.div
            animate={{ rotate: [0, -5, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 3 }}
          >
            <AlertTriangle size={80} className="text-red-500 mb-4" />
          </motion.div>

          <h2 className="text-3xl font-bold mb-3">
            SMS Quota Finished 💔
          </h2>
          <p className="text-base max-w-md mb-8">
            You’ve used all your available SMS units. Please recharge to continue
            sending messages and reaching your customers.
          </p>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() =>
              toast("💰 Top-up feature coming soon!", {
                icon: "💵",
                duration: 5000,
              })
            }
            className="px-8 py-3 text-lg rounded-full font-semibold text-white bg-gradient-to-r from-red-500 to-pink-600 hover:from-pink-600 hover:to-red-700 shadow-lg"
          >
            Top Up Now
          </motion.button>

          <motion.div
            whileHover={{ rotate: 90 }}
            className="mt-8 text-sm opacity-70 flex items-center gap-2 cursor-pointer"
            onClick={() => loadStats(true)}
          >
            <RefreshCcw size={16} />
            Refresh Dashboard
          </motion.div>
        </motion.div>
      ) : (
        // === Normal Table ===
        <motion.div
          className={`rounded-2xl shadow-lg overflow-hidden border transition ${
            darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div
            className={`p-5 border-b flex justify-between items-center ${
              darkMode
                ? "border-slate-700 text-gray-100"
                : "border-gray-200 text-gray-800"
            }`}
          >
            <h2 className="text-xl sm:text-2xl font-semibold">Recent Messages</h2>
            <span
              className={`text-sm ${
                darkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Showing newest messages first
            </span>
          </div>

          {error && (
            <div
              className={`p-4 text-center text-sm ${
                darkMode ? "text-yellow-400" : "text-yellow-600"
              }`}
            >
              {error}
            </div>
          )}

          {visibleMessages.length === 0 ? (
            <div
              className={`p-6 text-lg text-center ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              No messages yet.
            </div>
          ) : (
            <>
              <div
                className={`overflow-x-auto scrollbar-thin ${
                  darkMode
                    ? "scrollbar-thumb-slate-600"
                    : "scrollbar-thumb-gray-400"
                }`}
              >
                <table
                  className={`w-full text-sm sm:text-base ${
                    darkMode ? "text-gray-200" : "text-gray-800"
                  }`}
                >
                  <thead
                    className={`sticky top-0 z-10 ${
                      darkMode ? "bg-slate-900" : "bg-gray-100"
                    }`}
                  >
                    <tr>
                      <th className="text-left px-6 py-4 font-semibold">Phone</th>
                      <th className="text-left px-6 py-4 font-semibold">Status</th>
                      <th className="text-left px-6 py-4 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody
                    className={`divide-y ${
                      darkMode ? "divide-slate-700" : "divide-gray-200"
                    }`}
                  >
                    {visibleMessages.map((msg, i) => (
                      <ExpandableRow key={i} msg={msg} index={i} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div
                className={`flex justify-center items-center gap-4 py-6 border-t text-sm sm:text-base font-medium ${
                  darkMode
                    ? "border-slate-700 text-gray-300"
                    : "border-gray-200 text-gray-700"
                }`}
              >
                <button
                  onClick={() =>
                    stats &&
                    applyPagination(stats, Math.max(1, page - 1), filterStatus)
                  }
                  disabled={page === 1}
                  className={`px-4 py-2 rounded-lg shadow-sm transition ${
                    page === 1
                      ? darkMode
                        ? "bg-slate-700 text-gray-500 cursor-not-allowed"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  ← Previous
                </button>

                <span>
                  Page {page} of {totalPages || 1}
                </span>

                <button
                  onClick={() =>
                    stats &&
                    applyPagination(
                      stats,
                      Math.min(totalPages, page + 1),
                      filterStatus
                    )
                  }
                  disabled={page >= totalPages}
                  className={`px-4 py-2 rounded-lg shadow-sm transition ${
                    page >= totalPages
                      ? darkMode
                        ? "bg-slate-700 text-gray-500 cursor-not-allowed"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`rounded-2xl shadow-xl p-6 w-[90%] max-w-md border text-center ${
              darkMode
                ? "bg-slate-900 border-slate-700 text-gray-100"
                : "bg-white border-gray-200 text-gray-900"
            }`}
          >
            <h3 className="text-2xl font-bold mb-4">Confirm Resend</h3>
            <p className="text-base mb-6">
              This will resend your last message to{" "}
              <span className="font-semibold text-purple-500">
                all saved contacts
              </span>
              . <br />
              Do you want to continue?
            </p>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowConfirm(false)}
                className={`px-5 py-2 rounded-lg font-medium ${
                  darkMode
                    ? "bg-slate-700 hover:bg-slate-600"
                    : "bg-gray-200 hover:bg-gray-300"
                }`}
                disabled={isResending}
              >
                Cancel
              </button>
              <button
                onClick={handleResendAll}
                disabled={isResending}
                className={`px-6 py-2 rounded-lg font-semibold text-white shadow ${
                  isResending
                    ? "bg-purple-400 cursor-wait"
                    : "bg-purple-600 hover:bg-purple-700"
                }`}
              >
                {isResending ? "Resending..." : "Yes, Resend All"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default Dashboard;
