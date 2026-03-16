"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  THEME_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  darkMode: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyDocumentTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

function readStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
    return storedPreference === "light" || storedPreference === "dark"
      ? storedPreference
      : "system";
  } catch {
    return "system";
  }
}

function resolveDarkMode(preference: ThemePreference) {
  if (preference === "system") {
    return window.matchMedia(THEME_MEDIA_QUERY).matches;
  }

  return preference === "dark";
}

function getInitialThemeState() {
  return {
    // Keep the first client render aligned with the server render.
    // The mounted effect reconciles to the persisted/system theme immediately
    // after hydration, while the inline script already sets the document class.
    darkMode: false,
    preference:
      typeof window === "undefined"
        ? ("system" as ThemePreference)
        : readStoredThemePreference(),
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [{ darkMode, preference }, setThemeState] = useState(
    getInitialThemeState,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(THEME_MEDIA_QUERY);

    const syncTheme = (nextPreference: ThemePreference) => {
      const nextDarkMode = resolveDarkMode(nextPreference);
      applyDocumentTheme(nextDarkMode);
      setThemeState((current) =>
        current.darkMode === nextDarkMode &&
        current.preference === nextPreference
          ? current
          : {
              darkMode: nextDarkMode,
              preference: nextPreference,
            },
      );
    };

    syncTheme(preference);

    const handleChange = (event: MediaQueryListEvent) => {
      if (preference !== "system") {
        return;
      }

      applyDocumentTheme(event.matches);
      setThemeState((current) =>
        current.preference === "system"
          ? { ...current, darkMode: event.matches }
          : current,
      );
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [preference]);

  useEffect(() => {
    try {
      if (preference === "system") {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      return;
    }
  }, [preference]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      darkMode,
      toggleTheme: () => {
        const nextDarkMode = !darkMode;
        applyDocumentTheme(nextDarkMode);
        setThemeState({
          darkMode: nextDarkMode,
          preference: nextDarkMode ? "dark" : "light",
        });
      },
    }),
    [darkMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return value;
}
