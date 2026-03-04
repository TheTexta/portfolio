import Link from "next/link";
import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const baseClassName =
  "flex h-8 w-8 items-center justify-center border p-0 leading-none backdrop-blur-[2px] transition-colors [&_svg]:block [&_svg]:shrink-0";

type OverlayIconButtonProps = {
  toneClass: string;
  shape?: "square" | "round";
  className?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

type OverlayIconLinkProps = {
  href: string;
  toneClass: string;
  shape?: "square" | "round";
  className?: string;
  children: ReactNode;
  "aria-label": string;
};
export function OverlayIconButton({
  toneClass,
  shape = "square",
  className,
  children,
  type = "button",
  ...props
}: OverlayIconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        baseClassName,
        shape === "round" ? "rounded-full" : "rounded-md",
        toneClass,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function OverlayIconLink({
  href,
  toneClass,
  shape = "square",
  className,
  children,
  ...props
}: OverlayIconLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        baseClassName,
        shape === "round" ? "rounded-full" : "rounded-md",
        toneClass,
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
