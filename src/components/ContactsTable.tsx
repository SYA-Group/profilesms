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

interface Contact {
  id: number;
  name: string;
  phone: string;
  date_added: string;
}

const PAGE_SIZE = 20;

const ContactTable = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [visibleContacts, setVisibleContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "" });
  const [sortField, setSortField] = useState<keyof Contact>("date_added");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [page, setPage] = useState(1);

  // ✅ Load contacts (instant cache + safe storage)
  const loadContacts = async (forceRefresh = false) => {
    try {
      // --- 1. Use cached data instantly ---
      if (!forceRefresh) {
        const cached = sessionStorage.getItem("contacts_cache");
        if (cached) {
          try {
            const data: Contact[] = JSON.parse(cached);
            setContacts(data);
            setVisibleContacts(data.slice(0, PAGE_SIZE));
            setLoading(false);
          } catch {
            sessionStorage.removeItem("contacts_cache");
          }
        }
      }

      // --- 2. Refresh in background ---
      const res = await getContacts();
      setContacts(res);
      setVisibleContacts(res.slice(0, PAGE_SIZE));
      setPage(1);

      // ✅ Store smaller cache (avoid QuotaExceededError)
      const cacheSafeData = res.slice(0, 200); // cache only first 200
      try {
        sessionStorage.setItem("contacts_cache", JSON.stringify(cacheSafeData));
      } catch (e) {
        console.warn("⚠️ Contacts cache skipped:", e);
        sessionStorage.removeItem("contacts_cache");
      }
    } catch (err) {
      console.error("Error loading contacts:", err);
      // fallback if API fails
      const cached = sessionStorage.getItem("contacts_cache");
      if (cached) {
        try {
          const data: Contact[] = JSON.parse(cached);
          setContacts(data);
          setVisibleContacts(data.slice(0, PAGE_SIZE));
          setLoading(false);
          return;
        } catch {
          sessionStorage.removeItem("contacts_cache");
        }
      }
      toast.error("⚠️ Failed to load contacts.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this contact?")) return;
    try {
      await deleteContact(id);
      setContacts((prev) => {
        const updated = prev.filter((c) => c.id !== id);
        try {
          sessionStorage.setItem("contacts_cache", JSON.stringify(updated));
        } catch (e) {
          console.warn("⚠️ Cache update skipped:", e);
        }
        return updated;
      });
      setVisibleContacts((prev) => prev.filter((c) => c.id !== id));
      toast.success("Contact deleted");
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete contact.");
    }
  };

  const handleAdd = async () => {
    const { name, phone } = newContact;
    const newErrors: { name?: string; phone?: string } = {};

    if (!name.trim()) newErrors.name = "Name is required.";
    if (!phone.trim()) newErrors.phone = "Phone number is required.";

    let normalizedPhone = phone.trim();
    if (normalizedPhone.startsWith("+"))
      normalizedPhone = normalizedPhone.slice(1);
    if (normalizedPhone.startsWith("0"))
      normalizedPhone = "20" + normalizedPhone.slice(1);

    const egyptianPattern = /^20\d{10}$/;
    if (!newErrors.phone && !egyptianPattern.test(normalizedPhone)) {
      newErrors.phone =
        "Invalid Egyptian number. It must start with '20' and have 12 digits.";
    }

    if (!newErrors.phone && contacts.some((c) => c.phone === normalizedPhone)) {
      newErrors.phone = "This phone number already exists.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    try {
      await addContact({ name: name.trim(), phone: normalizedPhone });
      toast.success("Contact added successfully!");
      await loadContacts(true); // force refresh
      setShowModal(false);
      setNewContact({ name: "", phone: "" });
    } catch (err: any) {
      const message = err.response?.data?.error || "Failed to add contact.";
      toast.error(message);
    }
  };

  useEffect(() => {
    loadContacts();
    const interval = setInterval(() => loadContacts(true), 60000); // refresh every 60s
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

  useEffect(() => {
    setVisibleContacts(filteredContacts.slice(0, PAGE_SIZE));
    setPage(1);
  }, [search, sortField, sortOrder, contacts]);

  const handleSort = (field: keyof Contact) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (
      target.scrollTop + target.clientHeight >= target.scrollHeight - 10 &&
      !loadingMore
    ) {
      const nextPage = page + 1;
      const start = page * PAGE_SIZE;
      const nextContacts = filteredContacts.slice(start, start + PAGE_SIZE);
      if (nextContacts.length > 0) {
        setLoadingMore(true);
        setTimeout(() => {
          setVisibleContacts((prev) => [...prev, ...nextContacts]);
          setPage(nextPage);
          setLoadingMore(false);
        }, 300);
      }
    }
  };

  const handleExportCSV = () => {
    if (contacts.length === 0) {
      toast.error("No contacts to export.");
      return;
    }

    const headers = ["Name", "Phone", "Date Added"];
    const rows = contacts.map((c) => [
      `"${c.name}"`,
      `"${c.phone}"`,
      `"${new Date(c.date_added).toLocaleString()}"`,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
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
    <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900 text-lg">
      {/* Header & Controls */}
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-4xl font-extrabold text-gray-800 dark:text-white tracking-tight whitespace-nowrap">
            Contact List
          </h1>
          <div className="flex items-center gap-2 mt-2 text-gray-700 dark:text-gray-300 text-xl font-semibold whitespace-nowrap">
            <Users size={22} className="text-blue-600 dark:text-blue-400" />
            Total Customers:
            <span className="text-blue-600 dark:text-blue-400 ml-1">
              {totalCustomers}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search..."
              className="pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            onClick={() => loadContacts(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-lg font-medium shadow-md transition"
          >
            <RefreshCcw size={18} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-lg font-medium shadow-md transition"
          >
            <ArrowUpDown size={18} />
            Export CSV
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl text-lg font-medium shadow-md transition"
          >
            <Plus size={18} />
            Add Contact
          </button>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        className="overflow-x-auto shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-500 dark:text-gray-300 text-xl">
            Loading contacts...
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-500 dark:text-gray-300 text-xl">
            No contacts found.
          </div>
        ) : (
          <div
            className="max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-700"
            onScroll={handleScroll}
          >
            <table className="w-full border-collapse text-lg">
              <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 z-10">
                <tr>
                  <th
                    className="p-4 text-left font-semibold cursor-pointer hover:text-blue-600 select-none"
                    onClick={() => handleSort("name")}
                  >
                    Name <ArrowUpDown size={16} className="inline ml-1" />
                  </th>
                  <th
                    className="p-4 text-left font-semibold cursor-pointer hover:text-blue-600 select-none"
                    onClick={() => handleSort("phone")}
                  >
                    Phone <ArrowUpDown size={16} className="inline ml-1" />
                  </th>
                  <th
                    className="p-4 text-left font-semibold cursor-pointer hover:text-blue-600 select-none"
                    onClick={() => handleSort("date_added")}
                  >
                    Date Added <ArrowUpDown size={16} className="inline ml-1" />
                  </th>
                  <th className="p-4 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleContacts.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700/50 transition duration-150"
                  >
                    <td className="p-4 font-medium text-gray-900 dark:text-gray-100 break-words max-w-[250px]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{c.name}</span>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {c.phone}
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {new Date(c.date_added).toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition shadow-sm hover:shadow-md"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {loadingMore && (
              <div className="flex justify-center py-3 text-gray-500 dark:text-gray-300">
                Loading more...
              </div>
            )}
          </div>
        )}
                {/* Pagination Controls */}
                {!loading && filteredContacts.length > PAGE_SIZE && (
          <div className="flex justify-center items-center gap-4 mt-4 text-gray-700 dark:text-gray-300">
            <button
              disabled={page === 1}
              onClick={() => {
                const prevPage = Math.max(1, page - 1);
                const start = (prevPage - 1) * PAGE_SIZE;
                setVisibleContacts(filteredContacts.slice(start, start + PAGE_SIZE));
                setPage(prevPage);
              }}
              className={`px-4 py-2 rounded-lg text-lg font-medium shadow-sm transition ${
                page === 1
                  ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              ← Previous
            </button>

            <span className="font-semibold">
              Page {page} of {Math.ceil(filteredContacts.length / PAGE_SIZE)}
            </span>

            <button
              disabled={page >= Math.ceil(filteredContacts.length / PAGE_SIZE)}
              onClick={() => {
                const nextPage = page + 1;
                const start = (nextPage - 1) * PAGE_SIZE;
                setVisibleContacts(filteredContacts.slice(start, start + PAGE_SIZE));
                setPage(nextPage);
              }}
              className={`px-4 py-2 rounded-lg text-lg font-medium shadow-sm transition ${
                page >= Math.ceil(filteredContacts.length / PAGE_SIZE)
                  ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              Next →
            </button>
          </div>
        )}

      </motion.div>

      {/* Add Contact Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-[90%] max-w-md shadow-xl">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-white">
              Add New Contact
            </h2>

            <input
              className="w-full mb-2 p-3 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
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
              className="w-full mb-2 p-3 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
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
                className="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-600"
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
