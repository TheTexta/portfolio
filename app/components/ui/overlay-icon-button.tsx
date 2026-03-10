import { cva } from "class-variance-authority";
import Link from "next/link";
import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const overlayIconControl = cva(
  "inline-flex h-8 w-8 appearance-none items-center justify-center border p-0 [line-height:1] backdrop-blur-[2px] transition-colors [&_svg]:pointer-events-none [&_svg]:m-auto [&_svg]:block [&_svg]:shrink-0",
  {
    variants: {
      shape: {
        square: "rounded-md",
        round: "rounded-full",
      },
    },
    defaultVariants: {
      shape: "square",
    },
  },
);

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
      className={cn(overlayIconControl({ shape }), toneClass, className)}
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
      className={cn(overlayIconControl({ shape }), toneClass, className)}
      {...props}
    >
      {children}
    </Link>
  );
}
