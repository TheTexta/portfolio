"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const THEME_STORAGE_KEY = "portfolio-theme";

type ThemeContextValue = {
  darkMode: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyDocumentTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    const syncTheme = (isDark: boolean) => {
      applyDocumentTheme(isDark);
      setDarkMode(isDark);
    };

    if (storedTheme === "dark" || storedTheme === "light") {
      syncTheme(storedTheme === "dark");
      return;
    }

    syncTheme(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      syncTheme(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      darkMode,
      toggleTheme: () => {
        const nextDarkMode = !darkMode;
        applyDocumentTheme(nextDarkMode);
        window.localStorage.setItem(
          THEME_STORAGE_KEY,
          nextDarkMode ? "dark" : "light",
        );
        setDarkMode(nextDarkMode);
      },
    }),
    [darkMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return value;
}
