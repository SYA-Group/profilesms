import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface ThemeContextType {
  darkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // ✅ Load from localStorage or system preference
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // ✅ Apply theme class to <html> and persist
  useEffect(() => {
    const root = document.documentElement;

    if (darkMode) {
      root.classList.add("dark");

      // 🌙 Use your main dark navy tone
      root.style.backgroundColor = "#0f172a";
      root.style.setProperty("--bg-main-dark", "#0f172a");
      root.style.setProperty("--surface-dark", "#1e293b");
      root.style.setProperty("--text-dark", "#f9fafb");

      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");

      // ☀️ Default light colors
      root.style.backgroundColor = "#ffffff";
      root.style.setProperty("--bg-main-light", "#f9fafb");
      root.style.setProperty("--surface-light", "#ffffff");
      root.style.setProperty("--text-light", "#111827");

      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const toggleTheme = () => setDarkMode((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ✅ Custom hook for easy access
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
