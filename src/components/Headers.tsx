import { Moon, Sun, Menu, User, Bell, Globe } from "lucide-react";
import { useNavigate} from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { getUnreadNotifications, getUserInfo, markNotificationsRead } from "../api";
import { useTheme } from "../context/ThemeContext";
import "modern-normalize/modern-normalize.css";
import Cookies from "js-cookie";

interface HeaderProps {
  toggleSidebar?: () => void;
  onRefreshUser?: () => void;
}

interface UserInfo {
  username: string;
  email?: string;
  sms_sender_id: string;
  sms_quota: number;
  expires_at?: Date;
}

const Headers = ({ toggleSidebar, onRefreshUser }: HeaderProps) => {
  const navigate = useNavigate();
 
  const { darkMode, toggleTheme } = useTheme();

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

 
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("refresh_token");

    Cookies.remove("token");
    Cookies.remove("refresh_token");
    Cookies.remove("remember_username");
    Cookies.remove("remember_password");

    window.location.href = "/login";
  };

  const fetchUserInfo = async () => {
    try {
      const res = await getUserInfo();
      setUserInfo(res);
      onRefreshUser?.();
    } catch (err) {
      console.warn("⚠️ Could not load user info:", err);
    } finally {
      setLoading(false);
    }
  };
  const expiresAt = userInfo?.expires_at
  ? new Date(userInfo.expires_at).getTime()
  : null;

const remainingDays = expiresAt
  ? Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24))
  : null;

  // Fetch notifications every 10 seconds
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const res = await getUnreadNotifications();
        setNotifications(res.data || []);
      } catch {}
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch user info every 10 seconds
  useEffect(() => {
    fetchUserInfo();
    const interval = setInterval(fetchUserInfo, 10000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const remaining = Number(userInfo?.sms_quota ?? 0);
  const isQuotaEmpty = remaining <= 0;

  return (
    <header
      className="
        flex items-center justify-between
        bg-white text-gray-900 border-b border-gray-200
        dark:bg-[#0f172a] dark:text-white dark:border-gray-800
        px-6 py-3 shadow-md transition-colors
      "
    >
      {/* LEFT */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="md:hidden text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white"
        >
          <Menu size={22} />
        </button>

        {!loading && userInfo && (
          <div className="flex items-center flex-wrap gap-3">
            {/* Sender */}
            <div
              className="
              flex items-center gap-2
              bg-blue-100 text-blue-800 border border-blue-300
              dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700
              px-3 py-1.5 rounded-full backdrop-blur-sm
            "
            >
              <span className="font-semibold">{userInfo.sms_sender_id}</span>
            </div>

            {/* Quota */}
            <div
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full border
                transition-all duration-300 backdrop-blur-sm
                ${
                  isQuotaEmpty
                    ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700 animate-pulse"
                    : "bg-gradient-to-r from-green-100 to-green-200 text-green-800 border-green-300 dark:from-green-900/30 dark:to-green-800/20 dark:text-green-300 dark:border-green-700"
                }
              `}
            >
              <span className="font-medium">SMS:</span>
              <span className="font-bold text-lg tracking-wide">
                {isQuotaEmpty ? "0 ❌" : remaining.toLocaleString()}
              </span>

              <button
              onClick={() => (window.location.href = "/pricing#plans")}
              className={`
                ml-2 text-xs px-3 py-1 rounded-md font-semibold shadow-sm
                ${isQuotaEmpty ? "bg-red-600 hover:bg-red-700 text-white"
                              : "bg-green-600 hover:bg-green-700 text-white"}
              `}
            >
              {isQuotaEmpty ? "Recharge" : "Top up"}
            </button>

            </div>
          </div>
        )}
      </div>
      {remainingDays !== null && (
  <span className={`text-sm font-semibold ${
    remainingDays <= 7 ? "text-red-600 animate-pulse" : "text-green-600"
  }`}>
    {remainingDays} days left
  </span>
)}


      {/* RIGHT */}
      <div className="flex items-center gap-4" ref={dropdownRef}>
        {/* Language + Notifications */}
        <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
          <div className="flex items-center gap-1 cursor-pointer hover:text-blue-600 dark:hover:text-white">
            <Globe size={16} />
            <span className="text-sm">English</span>
          </div>

          {/* 🔔 Notifications */}
          <button
            onClick={async () => {
              if (!notifOpen && notifications.length > 0) {
                try {
                  await markNotificationsRead();
                } catch {}
              }
              setNotifOpen((v) => !v);
            }}
            
            className="relative hover:text-blue-600 dark:hover:text-white"
          >
            <Bell size={18} />

            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                {notifications.length}
              </span>
            )}
          </button>

          {/* Dropdown list */}
          {notifOpen && (
            <div
              className="
                absolute right-20 mt-2 w-72 bg-white dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
                rounded-lg shadow-xl z-50 p-3
              "
            >
              {notifications.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-2">
                  No new notifications
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-2 border-b border-gray-200 dark:border-gray-700"
                  >
                    <p className="font-semibold text-gray-800 dark:text-gray-100">
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      {n.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="text-gray-700 dark:text-gray-300 hover:text-yellow-500 dark:hover:text-yellow-400"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Profile */}
        {userInfo && (
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="
                flex items-center gap-2
                bg-gray-200 text-gray-800 hover:bg-gray-300
                dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700
                px-3 py-1.5 rounded-full transition
              "
            >
              <User size={18} />
              <span className="font-medium text-sm">{userInfo.username}</span>
            </button>

            {profileOpen && (
              <div
                className="
                  absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800
                  border border-gray-200 dark:border-gray-700
                  rounded-md shadow-lg z-50
                "
              >
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {userInfo.username}
                  </p>
                  {userInfo.email && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {userInfo.email}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => navigate("/change-password")}
                  className="
                    w-full text-left px-4 py-2 text-sm
                    text-gray-700 dark:text-gray-200
                    hover:bg-gray-100 dark:hover:bg-gray-700
                  "
                >
                  Change Password
                </button>

                <button
                  onClick={handleLogout}
                  className="
                    w-full text-left px-4 py-2 text-sm
                    text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700
                  "
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Headers;
