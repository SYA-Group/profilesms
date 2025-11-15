import { Moon, Sun, Menu, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { getUserInfo } from "../api";
import { useTheme } from "../context/ThemeContext"; // ✅ import global theme hook
import "modern-normalize/modern-normalize.css";

interface HeaderProps {
  toggleSidebar?: () => void;
  onRefreshUser?: () => void;
}

interface UserInfo {
  username: string;
  email?: string;
  sms_sender_id: string;
  sent_quota: number;
  total_quota: number;
}

const Headers = ({ toggleSidebar, onRefreshUser }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, toggleTheme } = useTheme(); // ✅ use global theme
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
      if (onRefreshUser) onRefreshUser();
    } catch (err) {
      console.warn("⚠️ Could not load user info:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
    const interval = setInterval(fetchUserInfo, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="flex items-center justify-between bg-white dark:bg-gray-900 shadow px-6 py-3 border-b border-gray-200 dark:border-gray-800 transition-colors">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="md:hidden text-gray-700 dark:text-gray-300"
        >
          <Menu size={22} />
        </button>

        <h1 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100">
          {pageTitle}
        </h1>

        {!loading && userInfo && (
          <div className="ml-6 flex items-center gap-4">
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-800">
              <span className="font-medium">Sender:</span>
              <span className="font-semibold text-base">
                {userInfo.sms_sender_id || "N/A"}
              </span>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-700">
              <span className="font-medium">SMS:</span>
              <span className="font-semibold text-base text-blue-600 dark:text-blue-400">
                {userInfo.sent_quota}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-base">
                /{userInfo.total_quota}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 relative" ref={dropdownRef}>
        <button
          onClick={toggleTheme}
          className="text-gray-600 dark:text-gray-300 hover:text-blue-600"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {userInfo && (
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 bg-gray-200 dark:bg-gray-800 px-3 py-1.5 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition"
            >
              <User size={18} />
              <span className="hidden sm:inline font-medium">
                {userInfo.username}
              </span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
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
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Change Password
                </button>

               {/* <button
                  onClick={() => navigate("/update-email")}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Update Email
                </button>*/
}
                

                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
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
