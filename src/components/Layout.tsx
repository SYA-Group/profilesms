// src/components/Layout.tsx
import { useState } from "react";
import Sidebar from "./Sidebar";
import Headers from "./Headers";
import "../index.css";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const token =
  localStorage.getItem("token") || sessionStorage.getItem("token");

  // ---------------------------
  // PUBLIC LAYOUT (no login)
  // ---------------------------
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-gray-100">

        {/* Public Navbar */}
        <header className="w-full px-6 py-4 flex items-center justify-between bg-white/70 dark:bg-gray-900/50 backdrop-blur-md shadow-sm">
          <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
            Profile SMS
          </h1>

          <div className="flex gap-4">
            <a
              href="/login"
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              Login
            </a>
            <a
              href="/register"
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              Register
            </a>
          </div>
        </header>

        {/* Main public content */}
        <main className="px-6 py-10">
          {children}
        </main>
      </div>
    );
  }

  // ---------------------------
  // DASHBOARD LAYOUT (logged in)
  // ---------------------------
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-[var(--bg-main-dark)] text-gray-900 dark:text-gray-100 transition-colors">
      
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-60" : "w-20"
        } hidden md:flex transition-all duration-300`}
      >
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Headers toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-[var(--bg-main-dark)] transition-colors">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
