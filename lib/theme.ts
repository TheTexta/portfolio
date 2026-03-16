export const THEME_STORAGE_KEY = "portfolio-theme";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export type ThemePreference = "light" | "dark" | "system";

export function getThemeInitScript() {
  return `
    (() => {
      const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
      const mediaQuery = ${JSON.stringify(THEME_MEDIA_QUERY)};
      const root = document.documentElement;
      let preference = "system";

      try {
        const stored = window.localStorage.getItem(storageKey);
        preference =
          stored === "light" || stored === "dark" ? stored : "system";
      } catch {}

      const isDark =
        preference === "dark" ||
        (preference === "system" &&
          window.matchMedia(mediaQuery).matches);

      root.classList.toggle("dark", isDark);
      root.style.colorScheme = isDark ? "dark" : "light";
    })();
  `;
}
