import { Moon, Sun, Menu, User, Bell, Globe } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { getUserInfo } from "../api";
import { useTheme } from "../context/ThemeContext";
import "modern-normalize/modern-normalize.css";

interface HeaderProps {
  toggleSidebar?: () => void;
  onRefreshUser?: () => void;
}

interface UserInfo {
  username: string;
  email?: string;
  sms_sender_id: string;
  sms_quota: number;  // remaining units from backend
}

const Headers = ({ toggleSidebar, onRefreshUser }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, toggleTheme } = useTheme();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const titles: Record<string, string> = {
    "/dashboard": "📊 Dashboard",
    "/contacts": "👥 Contacts",
    "/send": "💬 Send SMS",
    "/upload": "📤 Upload Contacts",
  };
  const pageTitle = titles[location.pathname] || "📊 SMS Dashboard";

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
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

  useEffect(() => {
    fetchUserInfo();
    const interval = setInterval(fetchUserInfo, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --------------------------------------------------
  // ⭐ SAFE FIX: always convert sms_quota to number
  // --------------------------------------------------
  const remaining = Number(userInfo?.sms_quota ?? 0); // ensures no NaN
  const isQuotaEmpty = remaining <= 0;

  return (
    <header className="
      flex items-center justify-between
      bg-white text-gray-900 border-b border-gray-200
      dark:bg-[#0f172a] dark:text-white dark:border-gray-800
      px-6 py-3 shadow-md transition-colors
    ">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="md:hidden text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white"
        >
          <Menu size={22} />
        </button>

        <h1 className="text-xl font-semibold">{pageTitle}</h1>

        {!loading && userInfo && (
          <div className="flex items-center flex-wrap gap-3">

            {/* Sender */}
            <div className="
              flex items-center gap-2
              bg-blue-100 text-blue-800 border border-blue-300
              dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700
              px-3 py-1.5 rounded-full backdrop-blur-sm
            ">
              <span className="font-medium">Sender:</span>
              <span className="font-semibold">{userInfo.sms_sender_id}</span>
            </div>

            {/* SMS Units */}
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
              <span className="font-medium">SMS UNIT:</span>
              <span className="font-bold text-lg tracking-wide">
                {isQuotaEmpty ? "0 ❌" : remaining.toLocaleString()}
              </span>

              <button
                onClick={() => alert("💰 Top-up feature coming soon!")}
                className={`
                  ml-2 text-xs px-3 py-1 rounded-md font-semibold shadow-sm
                  transition-all duration-200
                  ${
                    isQuotaEmpty
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }
                `}
              >
                {isQuotaEmpty ? "Recharge" : "Top up"}
              </button>
            </div>

            {/* API Status */}
            <div className="
              flex items-center gap-2
              bg-green-50 text-green-700 border border-green-300
              dark:bg-green-900/30 dark:text-green-400 dark:border-green-700
              px-3 py-1.5 rounded-full
            ">
              <span className="font-semibold">{userInfo.sms_sender_id} API</span>
              <span className="text-xs ml-1">Available ✅</span>
            </div>
          </div>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4" ref={dropdownRef}>
        <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
          <div className="flex items-center gap-1 cursor-pointer hover:text-blue-600 dark:hover:text-white">
            <Globe size={16} />
            <span className="text-sm">English</span>
          </div>
          <button className="hover:text-blue-600 dark:hover:text-white">
            <Bell size={18} />
          </button>
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
              <div className="
                absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
                rounded-md shadow-lg z-50
              ">
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
