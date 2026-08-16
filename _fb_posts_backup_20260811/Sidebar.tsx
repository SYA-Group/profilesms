// src/components/Sidebar.tsx
import { motion } from "framer-motion";
import { Home, Users, MessageSquare, Upload, X, UserPlus, LifeBuoy,CreditCard, Search  } from "lucide-react"; // added LifeBuoy
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { getUserInfo } from "../api";

interface SidebarProps {
  open: boolean;
  setOpen: (value: boolean) => void;
}

const Sidebar = ({ open, setOpen }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await getUserInfo();
        setIsAdmin(user.is_admin);
      } catch (err) {
        console.warn("⚠️ Failed to load user info", err);
      }
    };
    fetchUser();
  }, []);

  const links = [
    { name: "Dashboard", path: "/dashboard", icon: <Home size={20} /> },
    { name: "Send SMS", path: "/send", icon: <MessageSquare size={20} /> },
    { name: "Upload", path: "/upload", icon: <Upload size={20} /> },
    { name: "Contact Support", path: "/support", icon: <LifeBuoy size={20} /> }, 
    { name: "Pricing", path: "/pricing", icon: <CreditCard size={20} /> },
    { name: "Search Customers", path: "/elastic", icon: <Search size={20} /> },
    

// ✅ new link
  ];

  // Only add Register if admin
  if (isAdmin) {
  links.push(
    { name: "Register User", path: "/register", icon: <UserPlus size={20} /> },
    { name: "Manage Users", path: "/users", icon: <Users size={20} /> },
    { name: "Customers", path: "/contacts", icon: <Users size={20} /> },
    { name: "Add Pricing", path: "/add-pricing", icon: <Search size={20} /> }
  );
}

  const isMobile = () => window.innerWidth < 768;

  return (
    <>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
        />
      )}

      <motion.aside
        initial={false}
        animate={{ x: open ? 0 : -260 }}
        transition={{ duration: 0.25 }}
        className="fixed md:static z-40 h-screen w-60 bg-white dark:bg-gray-900 shadow-md border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h1 className="font-bold text-lg text-blue-600 dark:text-blue-400">
           Profile SMS
          </h1>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-600 dark:text-gray-300 md:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-2 py-4">
          {links.map((link) => {
            const active = location.pathname === link.path;
            return (
              <motion.button
                key={link.name}
                whileHover={{ scale: 1.03 }}
                onClick={() => {
                  navigate(link.path);
                  if (isMobile()) setOpen(false);
                }}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg mb-2 text-left transition-all ${
                  active
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {link.icon}
                <span>{link.name}</span>
              </motion.button>
            );
          })}
        </nav>

        <div className="p-4 text-xs text-gray-500 dark:text-gray-400 text-center">
          © 2025 Profile SMS System 
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
