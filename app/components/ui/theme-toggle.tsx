"use client";

import { useTheme } from "@/app/components/theme/theme-provider";
import { cn } from "@/lib/cn";

export default function ThemeToggle({ className }: { className?: string }) {
  const { darkMode, toggleTheme } = useTheme();

  return (
    <label
      className={cn(
        "inline-flex min-h-8 cursor-pointer items-center gap-2.5 text-[0.6875rem] font-bold tracking-[0.05em] uppercase text-ink",
        className,
      )}
    >
      <span>{darkMode ? "Light" : "Dark"}</span>
      <input
        type="checkbox"
        checked={darkMode}
        onChange={toggleTheme}
        className="absolute h-px w-px overflow-hidden opacity-0"
      />
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-[18px] w-[34px] shrink-0 items-center border p-0.5 transition-[border-color,background-color] duration-150",
          darkMode
            ? "border-ink bg-ink"
            : "border-rule bg-transparent",
        )}
      >
        <span
          className={cn(
            "block h-3 w-3 transition-transform duration-150",
            darkMode
              ? "translate-x-[14px] bg-canvas"
              : "translate-x-0 bg-ink",
          )}
        />
      </span>
    </label>
  );
}
