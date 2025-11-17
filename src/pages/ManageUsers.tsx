import { useEffect, useState } from "react";
import "modern-normalize/modern-normalize.css";
import { motion } from "framer-motion";
import {
  Trash2,
  Edit3,
  RefreshCcw,
  Search,
  KeyRound,
  ArrowUpDown,
  Users,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getUsers,
  updateUser,
  deleteUser,
  resetUserPassword,
  suspendUser,
} from "../api";

interface User {
  id: number;
  username: string;
  email: string;
  sms_quota: number;
  is_admin: number;
  suspended: number;
  created_at: string;
  company_type?: string; // ✅ NEW FIELD
}

const PAGE_SIZE = 20;

const ManageUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [visibleUsers, setVisibleUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<number | null>(
    null
  );
  const [newPassword, setNewPassword] = useState("");
  const [sortField, setSortField] = useState<keyof User>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
      setVisibleUsers(data.slice(0, PAGE_SIZE));
      setPage(1);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = users
    .filter(
      (u) =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.company_type ?? "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (sortField === "created_at") {
        const dateA = valA ? new Date(String(valA)).getTime() : 0;
        const dateB = valB ? new Date(String(valB)).getTime() : 0;
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      }
      return sortOrder === "asc"
        ? String(valA ?? "").localeCompare(String(valB ?? ""))
        : String(valB ?? "").localeCompare(String(valA ?? ""));
    });

  useEffect(() => {
    setVisibleUsers(filteredUsers.slice(0, PAGE_SIZE));
    setPage(1);
  }, [search, sortField, sortOrder, users]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (
      target.scrollTop + target.clientHeight >= target.scrollHeight - 10 &&
      !loadingMore
    ) {
      const nextPage = page + 1;
      const start = page * PAGE_SIZE;
      const next = filteredUsers.slice(start, start + PAGE_SIZE);
      if (next.length > 0) {
        setLoadingMore(true);
        setTimeout(() => {
          setVisibleUsers((prev) => [...prev, ...next]);
          setPage(nextPage);
          setLoadingMore(false);
        }, 300);
      }
    }
  };

  const handleSort = (field: keyof User) => {
    if (sortField === field) {
      setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this user?")) return;
    try {
      await deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("User deleted successfully");
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const handleEdit = async () => {
    if (!editingUser) return;
    try {
      await updateUser(editingUser.id, {
        email: editingUser.email,
        sms_quota: editingUser.sms_quota,
        is_admin: editingUser.is_admin,
        company_type: editingUser.company_type, // ✅ INCLUDE IN UPDATE
      });
      toast.success("User updated successfully");
      setEditingUser(null);
      loadUsers();
    } catch {
      toast.error("Failed to update user");
    }
  };

  const handleResetPassword = async (id: number) => {
    if (!newPassword.trim()) {
      toast.error("Enter a new password first");
      return;
    }
    try {
      await resetUserPassword(id, newPassword);
      toast.success("Password reset successfully");
      setNewPassword("");
      setShowPasswordModal(null);
    } catch {
      toast.error("Failed to reset password");
    }
  };

  const handleSuspend = async (id: number, suspended: boolean) => {
    try {
      await suspendUser(id, suspended);
      toast.success(
        `User ${suspended ? "suspended" : "unsuspended"} successfully`
      );
      setUsers((prev) =>
        prev.map((u) =>
          u.id === id ? { ...u, suspended: suspended ? 1 : 0 } : u
        )
      );
    } catch {
      toast.error("Failed to update suspension status");
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900 text-lg">
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-4xl font-extrabold text-gray-800 dark:text-white tracking-tight">
            Manage Users
          </h1>
          <div className="flex items-center gap-2 mt-2 text-gray-700 dark:text-gray-300 text-xl font-semibold">
            <Users size={22} className="text-blue-600 dark:text-blue-400" />
            Total Users:
            <span className="text-blue-600 dark:text-blue-400 ml-1">
              {users.length}
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
            onClick={loadUsers}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-lg font-medium shadow-md transition"
          >
            <RefreshCcw size={18} />
            Refresh
          </button>
        </div>
      </motion.div>

      <motion.div
        className="overflow-x-auto shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-500 dark:text-gray-300 text-xl">
            Loading users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-500 dark:text-gray-300 text-xl">
            No users found.
          </div>
        ) : (
          <div
            className="max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-700"
            onScroll={handleScroll}
          >
            <table className="w-full border-collapse text-lg">
              <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 z-10 whitespace-nowrap gap-2">
                <tr>
                  <th
                    className="p-4 text-left font-semibold cursor-pointer"
                    onClick={() => handleSort("username")}
                  >
                    Username <ArrowUpDown size={14} className="inline ml-1" />
                  </th>
                  <th
                    className="p-4 text-left font-semibold cursor-pointer"
                    onClick={() => handleSort("email")}
                  >
                    Email <ArrowUpDown size={14} className="inline ml-1" />
                  </th>
                  <th
                    className="p-4 text-left font-semibold cursor-pointer"
                    onClick={() => handleSort("company_type")}
                  >
                    Company Type{" "}
                    <ArrowUpDown size={14} className="inline ml-1" />
                  </th>
                  <th className="p-4 text-center font-semibold">
                    SMS Unit
                  </th>
                  <th className="p-4 text-center font-semibold">Admin</th>
                  <th className="p-4 text-center font-semibold">Suspended</th>
                  <th className="p-4 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((u, i) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className={`border-b border-gray-200 dark:border-gray-700 transition duration-150 ${
                      u.suspended
                        ? "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300"
                        : "hover:bg-blue-50 dark:hover:bg-gray-700/50"
                    }`}
                  >
                    {/* Username */}
                    <td className="p-4 font-semibold text-gray-900 dark:text-gray-100">
                      {editingUser?.id === u.id ? (
                        <input
                          value={editingUser.username}
                          onChange={(e) =>
                            setEditingUser({
                              ...editingUser,
                              username: e.target.value,
                            })
                          }
                          className="p-1 rounded-md border dark:bg-gray-700 dark:text-gray-100"
                        />
                      ) : (
                        u.username
                      )}
                    </td>

                    {/* Email */}
                    <td className="p-4 text-gray-800 dark:text-gray-200">
                      {editingUser?.id === u.id ? (
                        <input
                          value={editingUser.email}
                          onChange={(e) =>
                            setEditingUser({
                              ...editingUser,
                              email: e.target.value,
                            })
                          }
                          className="p-1 rounded-md border dark:bg-gray-700 dark:text-gray-100"
                        />
                      ) : (
                        u.email
                      )}
                    </td>

                    {/* Company Type */}
                    <td className="p-4 text-gray-800 dark:text-gray-200">
                      {editingUser?.id === u.id ? (
                        <select
                          value={editingUser.company_type ?? ""}
                          onChange={(e) =>
                            setEditingUser({
                              ...editingUser,
                              company_type: e.target.value,
                            })
                          }
                          className="p-1 rounded-md border bg-gray-50 dark:bg-gray-700 dark:text-gray-100"
                        >
                          <option value="">Select company type</option>
                          <option value="automobile">Automobile</option>
                          <option value="technology">Technology</option>
                          <option value="finance">Finance</option>
                          <option value="manufacturing">Manufacturing</option>
                          <option value="education">Education</option>
                          <option value="retail">Retail</option>
                          <option value="healthcare">Healthcare</option>
                          <option value="other">Other</option>
                        </select>
                      ) : u.company_type ? (
                        u.company_type.charAt(0).toUpperCase() +
                        u.company_type.slice(1)
                      ) : (
                        "-"
                      )}
                    </td>

                    {/* SMS Quota */}
                    <td className="p-4 text-center text-gray-700 dark:text-gray-300">
                      {editingUser?.id === u.id ? (
                        <input
                          type="number"
                          value={editingUser.sms_quota}
                          onChange={(e) =>
                            setEditingUser({
                              ...editingUser,
                              sms_quota: Number(e.target.value),
                            })
                          }
                          className="p-1 rounded-md border text-center dark:bg-gray-700 dark:text-gray-100"
                        />
                      ) : (
                        `${u.sms_quota}`
                      )}
                    </td>

                    {/* Admin */}
                    <td className="p-4 text-center">
                      {u.is_admin ? "✅" : "❌"}
                    </td>

                    {/* Suspended */}
                    <td className="p-4 text-center">
                      {u.suspended ? (
                        <span className="px-3 py-1 rounded-full bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-200 font-semibold">
                          Suspended
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-200 font-semibold">
                          Active
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-center flex justify-center gap-2">
                      {editingUser?.id === u.id ? (
                        <>
                          <button
                            onClick={handleEdit}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-lg"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleSuspend(u.id, !u.suspended)}
                            className={`${
                              u.suspended
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-orange-500 hover:bg-orange-600"
                            } text-white px-3 py-2 rounded-lg transition`}
                            title={
                              u.suspended ? "Unsuspend user" : "Suspend user"
                            }
                          >
                            {u.suspended ? (
                              <PlayCircle size={18} />
                            ) : (
                              <PauseCircle size={18} />
                            )}
                          </button>
                          <button
                            onClick={() => setEditingUser(u)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition"
                          >
                            <Edit3 size={18} />
                          </button>
                          <button
                            onClick={() => setShowPasswordModal(u.id)}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg transition"
                          >
                            <KeyRound size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
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
      </motion.div>

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-[90%] max-w-md shadow-xl">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-white">
              Reset Password
            </h2>
            <input
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 mb-4 border rounded-lg dark:bg-gray-700 dark:text-gray-100"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPasswordModal(null)}
                className="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResetPassword(showPasswordModal)}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
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

export default ManageUsers;
