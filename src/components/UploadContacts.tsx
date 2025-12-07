import { useEffect, useRef, useState } from "react";
import { addUploadedContact, exportUploadedContacts, getUploadedContacts, getUploadSMSProgress, sendUploadSMS, stopUploadSMS, uploadContacts } from "../api";
import { motion } from "framer-motion";
import { useTheme } from "../context/ThemeContext";
import { Search, RefreshCcw, ArrowUpDown, Plus } from "lucide-react";
import toast from "react-hot-toast";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { getSmsUnits } from "../utils/sms";


interface UploadRow {
  phone: string;
  name: string | null;
  status: string;
  created_at?: string | null;
}

interface UploadReport {
  message: string;
  inserted: number;
  skipped: number;
  total: number;
  total_in_db?: number | null;
  rows: UploadRow[];
}

const PAGE_SIZE = 10;



const formatCairoTime = (dateStr?: string | null) => {
  if (!dateStr) return "-";

  const d = new Date(dateStr);

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
};


const UploadContact = () => {
  const { darkMode } = useTheme();

  const emptyReport: UploadReport = {
    message: "",
    inserted: 0,
    skipped: 0,
    total: 0,
    total_in_db: 0,
    rows: [],
  };

  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const hydrated = useRef(false);

  const [stats, setStats] = useState({
    sent: 0,
    failed: 0,
    pending: 0,
    total: 0,
  });
  

  // New: Add Contact Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "" });
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const [report, setReport] = useState<UploadReport>(emptyReport);
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userKey = `upload_contacts_state_${user.id}`;
  type StatusFilter = "all" | "sent" | "failed" | "pending";

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");



  const statusData = [
    { name: "Sent", value: stats.sent },
    { name: "Failed", value: stats.failed },
    { name: "Pending", value: stats.pending },
  ];
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"phone" | "status">("phone");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  // ================== UPLOAD SMS STATE ==================
const [smsMessage, setSmsMessage] = useState("");
const [smsSending, setSmsSending] = useState(false);
const [smsProgress, setSmsProgress] = useState({
  sent: 0,
  failed: 0,
  units_used: 0,
});


const timelineData = Object.values(
  report.rows.reduce((acc: any, row) => {
    if (row.status !== "sent" || !row.created_at) return acc;

    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Cairo",
      hour: "numeric",
      hour12: true,
    }).format(new Date(row.created_at));

    acc[hour] = acc[hour] || { hour, count: 0 };
    acc[hour].count += 1;
    return acc;
  }, {})
);


  const handleUpload = async () => {
    if (!file) return alert("Please select a file first!");
    setLoading(true);
    setMessage("");

    try {
      const res = await uploadContacts(file);

      setMessage(res.message || "Contacts uploaded successfully!");

      setReport({
        message: res.message,
        inserted: res.inserted,
        skipped: res.skipped,
        total: res.total,
        total_in_db: res.total_in_db,
        rows: res.rows || [],
      });
    } catch {
      setMessage("Failed to upload contacts.");
      setReport(emptyReport);
    } finally {
      setLoading(false);
    }
  };

  const refreshUploaded = async () => {
    try {
      const res = await getUploadedContacts(page, statusFilter);
  
      setReport((prev) => ({
        ...prev,
        rows: res.rows || [],
        total_in_db: res.total_in_db ?? 0,
      }));
  
      if (res.stats) {
        setStats({
          sent: res.stats.sent,
          failed: res.stats.failed,
          pending: res.stats.pending,
          total: res.stats.total,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  const handleStartUploadSMS = async () => {
    if (!smsMessage.trim())
      return toast.error("Please enter SMS message");
  
    try {
      await sendUploadSMS({ message: smsMessage.trim() });
      setSmsSending(true);
      toast.success("Upload SMS started");
    } catch {
      toast.error("Failed to start upload SMS");
    }
  };
  
  const handleStopUploadSMS = async () => {
    try {
      await stopUploadSMS();
      setSmsSending(false);
      setSmsProgress({ sent: 0, failed: 0, units_used: 0 });
      toast("Upload SMS stopped");
    } catch {
      toast.error("Failed to stop upload SMS");
    }
  };
  
  useEffect(() => {
    refreshUploaded();
  }, [page, statusFilter]);
  
  
  useEffect(() => {
    refreshUploaded();
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
  
    // ✅ DO NOT overwrite storage with empty message
    if (!smsMessage && !search && page === 1) return;
  
    localStorage.setItem(
      userKey,
      JSON.stringify({
        smsMessage,
        search,
        page,
      })
    );
  }, [smsMessage, search, page]);
  
  
  useEffect(() => {
    const saved = localStorage.getItem(userKey);
    if (!saved) {
      hydrated.current = true;
      return;
    }
  
    try {
      const parsed = JSON.parse(saved);
  
      if (parsed.smsMessage !== undefined)
        setSmsMessage(parsed.smsMessage);
  
      if (parsed.search !== undefined)
        setSearch(parsed.search);
  
      if (parsed.page !== undefined)
        setPage(parsed.page);
    } catch {}
  
    hydrated.current = true;
  }, []);
  
  

  const sortedRows = [...report.rows].sort((a, b) => {
    const dir = sortOrder === "asc" ? 1 : -1;
  
    if (sortField === "phone") {
      return a.phone.localeCompare(b.phone) * dir;
    }
  
    if (sortField === "status") {
      return a.status.localeCompare(b.status) * dir;
    }
  
    return 0;
  });


  const totalPages = Math.ceil((report.total_in_db || 0) / PAGE_SIZE);
  const visible = sortedRows;



  const toggleSort = (field: "phone" | "status") => {
    if (sortField === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  
  

  useEffect(() => {
    if (!smsSending) return;
  
    const t = setInterval(async () => {
      try {
        const res = await getUploadSMSProgress();
        setSmsProgress(res || { sent: 0, failed: 0, units_used: 0 });
      } catch {}
    }, 2000);
  
    return () => clearInterval(t);
  }, [smsSending]);

  useEffect(() => {
    if (!smsSending) return;
  
    const interval = setInterval(() => {
      refreshUploaded();
    }, 3000); // every 3 seconds
  
    return () => clearInterval(interval);
  }, [smsSending]);
  
  

  const handleExportCSV = async () => {
    try {
      const rows = await exportUploadedContacts(statusFilter);
  
      if (!rows.length) {
        toast.error("No data to export");
        return;
      }
  
      const headers = ["Phone", "Name", "Status", "Sent Time"];
      const csvRows = rows.map((r: UploadRow) => [
        `"${r.phone}"`,
        `"${r.name ?? ""}"`,
        `"${r.status}"`,
        `"${formatCairoTime(r.created_at)}"`,
      ]);
  
      const csv = [headers.join(","), ...csvRows.map((r: any[]) => r.join(","))].join("\n");
  
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
  
      const link = document.createElement("a");
      link.href = url;
      link.download = `uploaded_contacts_${statusFilter}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  
    } catch {
      toast.error("Failed to export data");
    }
  };
  
  
  

  // ADD CONTACT MANUALLY
  const handleAddContact = async () => {
    const { name, phone } = newContact;
    const errs: { name?: string; phone?: string } = {};
  
    if (!phone.trim()) errs.phone = "Phone required";
  
    let normalized = phone.trim();
    if (normalized.startsWith("+")) normalized = normalized.slice(1);
    if (normalized.startsWith("0")) normalized = "20" + normalized.slice(1);
  
    const pattern = /^20\d{10}$/;
    if (!pattern.test(normalized)) errs.phone = "Invalid Egyptian number";
  
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
  
    setErrors({});
  
    try {
      const res = await addUploadedContact({
        name: name.trim(),
        phone: normalized,
      });
    
      toast.success("Contact added");
    
      // ✅ USE BACKEND ROW (REAL STATUS)
      setReport((prev) => ({
        ...prev,
        rows: [res.row, ...prev.rows],  // ✅ comes from DB
        inserted: prev.inserted + 1,
        total_in_db: (prev.total_in_db ?? 0) + 1,
      }));
    
      setShowAddModal(false);
      setNewContact({ name: "", phone: "" });
    } catch (err: any) {
    
      toast.error(err?.response?.data?.error || "Failed to add contact.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-8 bg-gray-50 dark:bg-gray-900">

      {/* Upload Card */}
      <motion.div
        className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg w-full max-w-lg mb-10"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-gray-100">
          Upload Contacts
        </h1>

        <input
          type="file"
          accept=".csv,.xlsx"
          className="w-full mb-4 border rounded-md p-2 dark:bg-gray-700"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <button
          onClick={() => setShowFormatModal(true)}
          className="text-blue-600 dark:text-blue-400 underline text-sm mb-4"
        >
          View required file format
        </button>

        <button
          onClick={handleUpload}
          disabled={loading}
          className={`w-full py-2 rounded-md font-semibold ${
            loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {loading ? "Uploading..." : "Upload"}
        </button>

        {message && (
          <p className="text-center mt-4 text-sm">{message}</p>
        )}
      </motion.div>

      {/* Summary Cards */}
      <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-12">
        <div className="p-5 rounded-2xl bg-blue-600 text-white shadow">
          <div className="text-sm opacity-80">Total in file</div>
          <div className="text-2xl font-bold">{report.total}</div>
        </div>

        <div className="p-5 rounded-2xl bg-green-600 text-white shadow">
          <div className="text-sm opacity-80">Inserted</div>
          <div className="text-2xl font-bold">{report.inserted}</div>
        </div>

        <div className="p-5 rounded-2xl bg-yellow-500 text-white shadow">
          <div className="text-sm opacity-80">Duplicates</div>
          <div className="text-2xl font-bold">{report.skipped}</div>
        </div>

        <div
  onClick={() => {
    setStatusFilter("all");
    setPage(1);
  }}
  className={`p-5 rounded-2xl bg-purple-600 text-white shadow cursor-pointer
    ${statusFilter === "all" ? "ring-4 ring-white/40" : ""}`}
>

          <div className="text-sm opacity-80">Total in DB</div>
          <div className="text-2xl font-bold">{report.total_in_db}</div>
        </div>
        <div
          onClick={() => {
            setStatusFilter("sent");
            setPage(1);
          }}
          className={`p-5 rounded-2xl bg-green-700 text-white shadow cursor-pointer
            ${statusFilter === "sent" ? "ring-4 ring-white/40" : ""}`}
        >

      <div className="text-sm opacity-80">Sent</div>
      <div className="text-2xl font-bold">{stats.sent}</div>
    </div>

    <div
  onClick={() => {
    setStatusFilter("failed");
    setPage(1);
  }}
  className={`p-5 rounded-2xl bg-red-600 text-white shadow cursor-pointer
    ${statusFilter === "failed" ? "ring-4 ring-white/40" : ""}`}
>

      <div className="text-sm opacity-80">Failed</div>
      <div className="text-2xl font-bold">{stats.failed}</div>
    </div>

      </div>
      {/* ================= REPORT VISUALIZATION ================= */}
<div className="w-full max-w-3xl grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">

{/* Status Distribution */}
<div className={`p-6 rounded-2xl shadow ${darkMode ? "bg-slate-800" : "bg-white"}`}>
  <h3 className="font-semibold mb-4">Delivery Status Distribution</h3>
  <ResponsiveContainer width="100%" height={200}>
    <PieChart>
      <Pie data={statusData} dataKey="value" outerRadius={90} label>
        <Cell fill="#16a34a" /> {/* Sent */}
        <Cell fill="#dc2626" /> {/* Failed */}
        <Cell fill="#eab308" /> {/* Pending */}
      </Pie>
      <Tooltip />
    </PieChart>
  </ResponsiveContainer>
</div>

{/* Timeline */}
<div className={`p-6 rounded-2xl shadow ${darkMode ? "bg-slate-800" : "bg-white"}`}>
  <h3 className="font-semibold mb-4">Messages Sent Over Time (Cairo)</h3>
  <ResponsiveContainer width="100%" height={200}>
    <BarChart data={timelineData}>
      <XAxis dataKey="hour" />
      <YAxis />
      <Tooltip />
      <Bar dataKey="count" fill="#2563eb" />
    </BarChart>
  </ResponsiveContainer>
</div>

</div>
{/* ======================================================== */}


      {/* Upload Table Controls */}
      <div className="w-full max-w-5xl flex flex-wrap justify-between mb-6 gap-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-3 text-gray-400"
            size={18}
          />
          <input
            placeholder="Search phone or status..."
            className="pl-10 pr-4 py-2 rounded-xl border dark:bg-slate-800"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl"
          >
            <Plus size={18} /> Add Contact
          </button>

          <div className="flex gap-2">
          <button
  onClick={handleExportCSV}
  className="bg-yellow-500 hover:bg-yellow-600 text-white px-5 py-2 rounded-xl"
>
  Export ({statusFilter.toUpperCase()})
</button>

</div>


          <button
            onClick={refreshUploaded}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl"
          >
            <RefreshCcw size={18} /> Refresh
          </button>
        </div>
      </div>

      {/* TABLE */}
      <motion.div
        className={`rounded-2xl shadow-lg overflow-hidden border ${
          darkMode ? "bg-slate-800" : "bg-white"
        } w-full max-w-5xl`}
      >
        <table className="w-full text-base">
        <thead>
        <tr>
  <th
    onClick={() => toggleSort("phone")}
    className="px-6 py-4 font-semibold cursor-pointer"
  >
    Phone <ArrowUpDown size={14} className="inline ml-1" />
  </th>

  <th className="px-6 py-4 font-semibold">
    Status
  </th>

  <th className="px-6 py-4 font-semibold">
    Sent Time (Cairo)
  </th>
</tr>
</thead>


<tbody>
  {visible.map((row, i) => (
    <tr
      key={i}
      className={`transition ${
        darkMode ? "hover:bg-slate-700/50" : "hover:bg-gray-100"
      }`}
    >
      <td className="px-6 py-3 font-mono">{row.phone}</td>

      <td className="px-6 py-3">
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            row.status === "sent"
              ? "bg-green-200 text-green-800"
              : row.status === "failed"
              ? "bg-red-200 text-red-800"
              : "bg-yellow-200 text-yellow-800"
          }`}
        >
          {row.status}
        </span>
      </td>

      <td className="px-6 py-3 text-sm">
        {row.status === "sent"
          ? formatCairoTime(row.created_at)
          : "-"}
      </td>
    </tr>
  ))}
</tbody>

        </table>

        {/* Pagination */}
        <div className="flex justify-center gap-4 py-5">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:bg-gray-500"
          >
            ← Previous
          </button>
          <span className="py-2">
            Page {page} of {totalPages || 1}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:bg-gray-500"
          >
            Next →
          </button>
        </div>
      </motion.div>
      {/* ================= UPLOAD SMS PANEL ================= */}
<motion.div
  className="mt-10 w-full max-w-5xl bg-white dark:bg-slate-800 rounded-2xl shadow p-6"
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
>
  <h2 className="text-xl font-bold mb-3 text-gray-800 dark:text-gray-100">
    Send SMS to Uploaded Numbers
  </h2>

  <textarea
    className="w-full h-28 p-3 rounded-lg border dark:bg-slate-900"
    placeholder="Write SMS message here..."
    value={smsMessage}
    onChange={(e) => setSmsMessage(e.target.value)}
    disabled={smsSending}
  />
<div className="flex justify-between text-xs text-gray-500">
  <span>{smsMessage.length} characters</span>
  <span>{getSmsUnits(smsMessage)} SMS unit(s)</span>
</div>
  <div className="flex gap-3 mt-4">
    <button
      onClick={handleStartUploadSMS}
      disabled={smsSending}
      className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl disabled:bg-gray-400"
    >
      Start Sending
    </button>

    <button
      onClick={handleStopUploadSMS}
      disabled={!smsSending}
      className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:bg-gray-400"
    >
      Stop
    </button>
  </div>

  {/* Progress */}
  {smsSending && (
    <div className="mt-6">
      <div className="flex gap-6 text-sm">
        <span>✅ Sent: {smsProgress.sent}</span>
        <span>❌ Failed: {smsProgress.failed}</span>
        <span>📦 Units Used: {smsProgress.units_used}</span>
      </div>

      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 overflow-hidden">
        <div
          className="h-full bg-green-600 transition-all"
          style={{
            width: `${
              smsProgress.sent + smsProgress.failed
                ? (smsProgress.sent /
                    (smsProgress.sent + smsProgress.failed)) *
                  100
                : 0
            }%`,
          }}
        />
      </div>
    </div>
  )}
</motion.div>
{/* ==================================================== */}


      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div
            className={`p-6 rounded-2xl w-[90%] max-w-md border shadow-xl ${
              darkMode ? "bg-slate-900 border-slate-700" : "bg-white"
            }`}
          >
            <h2 className="text-2xl font-semibold mb-4 text-center">
              Add Contact
            </h2>

            <input
              className="w-full mb-3 p-3 rounded-lg border dark:bg-slate-800"
              placeholder="Name"
              value={newContact.name}
              onChange={(e) =>
                setNewContact((p) => ({ ...p, name: e.target.value }))
              }
            />
            {errors.name && (
              <p className="text-red-500 text-sm mb-2">{errors.name}</p>
            )}

            <input
              className="w-full mb-3 p-3 rounded-lg border dark:bg-slate-800"
              placeholder="Phone"
              value={newContact.phone}
              onChange={(e) =>
                setNewContact((p) => ({ ...p, phone: e.target.value }))
              }
            />
            {errors.phone && (
              <p className="text-red-500 text-sm mb-2">{errors.phone}</p>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-300 dark:bg-slate-700"
              >
                Cancel
              </button>

              <button
                onClick={handleAddContact}
                className="px-5 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Format Modal */}
      {showFormatModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <motion.div
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-[90%] max-w-md"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <h2 className="text-xl font-semibold mb-3">Required File Format</h2>

            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded text-sm font-mono">
              phone,name<br />
              201012345678,Ahmed<br />
              201198765432,Mohamed
            </div>

            <button
              onClick={() => setShowFormatModal(false)}
              className="mt-4 w-full py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default UploadContact;
