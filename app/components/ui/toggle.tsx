"use client";

import { cn } from "@/lib/cn";

type ToggleProps = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
};

export default function Toggle({
  label,
  checked,
  disabled,
  onChange,
  className,
}: ToggleProps) {
  return (
    <label
      className={cn(
        "inline-flex min-h-8 cursor-pointer items-center gap-2 text-ink uppercase has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-ink",
        className,
      )}
    >
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="absolute size-px overflow-hidden opacity-0"
      />
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-[18px] w-[34px] shrink-0 items-center border p-0.5 transition-[border-color,background-color] duration-150",
          checked ? "border-ink bg-ink" : "border-ink bg-transparent",
        )}
      >
        <span
          className={cn(
            "block size-3 transition-transform duration-150",
            checked ? "translate-x-[14px] bg-canvas" : "translate-x-0 bg-ink",
          )}
        />
      </span>
    </label>
  );
}
