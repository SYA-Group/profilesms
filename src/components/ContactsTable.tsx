import { useEffect, useState } from "react";
import { getContacts, deleteContact, addContact } from "../api";
import { motion } from "framer-motion";
import {
  Trash2,
  RefreshCcw,
  Search,
  Plus,
  Users,
  ArrowUpDown,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTheme } from "../context/ThemeContext"; // ✅ added for theme awareness

interface Contact {
  id: number;
  name: string;
  phone: string;
  date_added: string;
}

const PAGE_SIZE = 5;

const ContactTable = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [visibleContacts, setVisibleContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "" });
  const [sortField, setSortField] = useState<keyof Contact>("date_added");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [page, setPage] = useState(1);
  const { darkMode } = useTheme(); // ✅ theme hook

  // ✅ Load contacts
  const loadContacts = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        const cached = sessionStorage.getItem("contacts_cache");
        if (cached) {
          const data: Contact[] = JSON.parse(cached);
          setContacts(data);
          setVisibleContacts(data.slice(0, PAGE_SIZE));
          setLoading(false);
        }
      }

      const res = await getContacts();
      setContacts(res);
      setVisibleContacts(res.slice(0, PAGE_SIZE));
      setPage(1);
      sessionStorage.setItem(
        "contacts_cache",
        JSON.stringify(res.slice(0, 200))
      );
    } catch (err) {
      console.error("Error loading contacts:", err);
      toast.error("⚠️ Failed to load contacts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
    const interval = setInterval(() => loadContacts(true), 10000);
    return () => clearInterval(interval);
  }, []);

  // ✅ Filter & sort logic
  const filteredContacts = contacts
    .filter(
      (c) =>
        (c.name?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
        (c.phone ?? "").includes(search)
    )
    .sort((a, b) => {
      const valA = a[sortField] ?? "";
      const valB = b[sortField] ?? "";
      if (sortField === "date_added") {
        const dateA = new Date(valA).getTime();
        const dateB = new Date(valB).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      }
      return sortOrder === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

  const totalPages = Math.ceil(filteredContacts.length / PAGE_SIZE);

  useEffect(() => {
    const start = (page - 1) * PAGE_SIZE;
    setVisibleContacts(filteredContacts.slice(start, start + PAGE_SIZE));
  }, [search, sortField, sortOrder, contacts, page]);

  const handleSort = (field: keyof Contact) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this contact?")) return;
    try {
      await deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
      toast.success("Contact deleted");
    } catch (err) {
      toast.error("Failed to delete contact.");
    }
  };

  const handleAdd = async () => {
    const { name, phone } = newContact;
    const newErrors: { name?: string; phone?: string } = {};
    if (!name.trim()) newErrors.name = "Name is required.";
    if (!phone.trim()) newErrors.phone = "Phone number is required.";

    let normalized = phone.trim();
    if (normalized.startsWith("+")) normalized = normalized.slice(1);
    if (normalized.startsWith("0")) normalized = "20" + normalized.slice(1);
    const egyptPattern = /^20\d{10}$/;
    if (!newErrors.phone && !egyptPattern.test(normalized)) {
      newErrors.phone = "Invalid Egyptian number format.";
    }
    if (contacts.some((c) => c.phone === normalized))
      newErrors.phone = "Phone number already exists.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    try {
      await addContact({ name: name.trim(), phone: normalized });
      toast.success("Contact added successfully!");
      setShowModal(false);
      setNewContact({ name: "", phone: "" });
      loadContacts(true);
    } catch {
      toast.error("Failed to add contact.");
    }
  };

  const handleExportCSV = () => {
    if (contacts.length === 0) return toast.error("No contacts to export.");
    const headers = ["Name", "Phone", "Date Added"];
    const rows = contacts.map((c) => [
      `"${c.name}"`,
      `"${c.phone}"`,
      `"${new Date(c.date_added).toLocaleString()}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "contacts.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalCustomers = contacts.length;

  return (
    <div
      className={`
        min-h-screen px-6 sm:px-8 lg:px-12 py-8 transition-all duration-300
        ${darkMode
          ? "bg-[#0f172a] text-gray-100"
          : "bg-gray-50 text-gray-900"}
      `}
    >
      {/* Header */}
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-10 gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Contact List
          </h1>
          <div
            className={`flex items-center gap-2 mt-2 text-lg ${
              darkMode ? "text-gray-300" : "text-gray-600"
            }`}
          >
            <Users
              size={22}
              className={darkMode ? "text-blue-400" : "text-blue-600"}
            />
            Total Customers:
            <span
              className={`font-semibold ml-1 ${
                darkMode ? "text-blue-400" : "text-blue-600"
              }`}
            >
              {totalCustomers}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 justify-end">
          <div className="relative">
            <Search
              className={`absolute left-3 top-3 ${
                darkMode ? "text-gray-400" : "text-gray-500"
              }`}
              size={20}
            />
            <input
              type="text"
              placeholder="Search..."
              className={`
                pl-10 pr-4 py-2.5 rounded-xl border text-base
                focus:ring-2 focus:ring-blue-500 outline-none
                ${darkMode
                  ? "bg-slate-800 border-slate-700 text-gray-100"
                  : "bg-white border-gray-300 text-gray-900"}
              `}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => loadContacts(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-medium shadow-md"
          >
            <RefreshCcw size={18} /> Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 rounded-xl text-white font-medium shadow-md"
          >
            <ArrowUpDown size={18} /> Export
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 rounded-xl text-white font-medium shadow-md"
          >
            <Plus size={18} /> Add Contact
          </button>
        </div>
      </motion.div>

      {/* === Table === */}
      <motion.div
        className={`
          rounded-2xl shadow-lg overflow-hidden border
          ${darkMode
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-gray-200"}
        `}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {loading ? (
          <div
            className={`flex items-center justify-center h-48 ${
              darkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            Loading contacts...
          </div>
        ) : filteredContacts.length === 0 ? (
          <div
            className={`flex items-center justify-center h-48 ${
              darkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            No contacts found.
          </div>
        ) : (
          <>
            <table
              className={`w-full text-base ${
                darkMode ? "text-gray-200" : "text-gray-800"
              }`}
            >
              <thead
                className={`sticky top-0 z-10 ${
                  darkMode ? "bg-slate-900" : "bg-gray-100"
                }`}
              >
                <tr>
                  {["name", "phone", "date_added"].map((field) => (
                    <th
                      key={field}
                      onClick={() => handleSort(field as keyof Contact)}
                      className="px-6 py-4 text-left font-semibold cursor-pointer hover:text-blue-500"
                    >
                      {field === "name"
                        ? "Name"
                        : field === "phone"
                        ? "Phone"
                        : "Date Added"}{" "}
                      <ArrowUpDown size={14} className="inline ml-1" />
                    </th>
                  ))}
                  <th className="px-6 py-4 text-center font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody
                className={`divide-y ${
                  darkMode ? "divide-slate-700" : "divide-gray-200"
                }`}
              >
                {visibleContacts.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`transition duration-150 ${
                      darkMode
                        ? "hover:bg-slate-700/50"
                        : "hover:bg-gray-100/80"
                    }`}
                  >
                    <td className="px-6 py-3 font-semibold">{c.name}</td>
                    <td className="px-6 py-3 font-mono">{c.phone}</td>
                    <td className="px-6 py-3">
                      {new Date(c.date_added).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div
              className={`flex justify-center items-center gap-4 py-5 border-t ${
                darkMode
                  ? "border-slate-700 text-gray-300"
                  : "border-gray-200 text-gray-700"
              }`}
            >
              <button
                disabled={page === 1}
                onClick={() => setPage(Math.max(1, page - 1))}
                className={`px-4 py-2 rounded-lg font-medium ${
                  page === 1
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                ← Previous
              </button>
              <span className="font-semibold">
                Page {page} of {totalPages || 1}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                className={`px-4 py-2 rounded-lg font-medium ${
                  page >= totalPages
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </motion.div>

      {/* === Add Contact Modal === */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            className={`p-6 rounded-2xl w-[90%] max-w-md shadow-xl border
              ${darkMode
                ? "bg-slate-900 text-white border-slate-700"
                : "bg-white text-gray-900 border-gray-300"}
            `}
          >
            <h2 className="text-2xl font-semibold mb-4 text-center">
              Add New Contact
            </h2>

            <input
              className={`w-full mb-3 p-3 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none
                ${darkMode
                  ? "bg-slate-800 border-slate-700 text-white"
                  : "bg-gray-50 border-gray-300 text-gray-900"}
              `}
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
              className={`w-full mb-3 p-3 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none
                ${darkMode
                  ? "bg-slate-800 border-slate-700 text-white"
                  : "bg-gray-50 border-gray-300 text-gray-900"}
              `}
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
                onClick={() => setShowModal(false)}
                className={`px-4 py-2 rounded-lg font-medium transition
                  ${darkMode
                    ? "bg-slate-700 hover:bg-slate-600 text-gray-200"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-800"}
                `}
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="px-5 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactTable;
