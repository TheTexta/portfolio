"use client";

import { useTheme } from "@/app/components/theme/theme-provider";
import Toggle from "./toggle";

export default function ThemeToggle({ className }: { className?: string }) {
  const { darkMode, toggleTheme } = useTheme();

  return (
    <Toggle
      label={darkMode ? "Light" : "Dark"}
      checked={darkMode}
      onChange={toggleTheme}
      className={className}
    />
  );
}
