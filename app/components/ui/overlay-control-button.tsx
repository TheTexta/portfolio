import { cva } from "class-variance-authority";
import Link from "next/link";
import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

const overlayControlBase = cva(
  "focus-visible:ring-accent/70 inline-flex appearance-none items-center justify-center border backdrop-blur-[2px] transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-offset-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      layout: {
        icon: "p-0 [line-height:1] [&_svg]:pointer-events-none [&_svg]:m-auto [&_svg]:block [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
        action: "leading-none font-medium",
      },
      size: {
        sm: "",
        md: "",
        lg: "",
      },
      shape: {
        square: "rounded-md",
        round: "rounded-full",
      },
    },
    compoundVariants: [
      {
        layout: "icon",
        size: "sm",
        class: "h-7 w-7",
      },
      {
        layout: "icon",
        size: "md",
        class: "h-8 w-8",
      },
      {
        layout: "icon",
        size: "lg",
        class: "h-10 w-10",
      },
      {
        layout: "action",
        size: "sm",
        class: "px-2 py-1 text-xs",
      },
      {
        layout: "action",
        size: "md",
        class: "px-3 py-1.5 text-sm",
      },
      {
        layout: "action",
        size: "lg",
        class: "px-4 py-2 text-sm",
      },
    ],
    defaultVariants: {
      layout: "icon",
      size: "md",
      shape: "square",
    },
  },
);

type OverlayControlLayout = "icon" | "action";
type OverlayControlShape = "square" | "round";
type OverlayControlSize = "sm" | "md" | "lg";

type OverlayControlButtonProps = {
  toneClass: string;
  layout?: OverlayControlLayout;
  size?: OverlayControlSize;
  shape?: OverlayControlShape;
  className?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

type OverlayControlLinkProps = {
  href: string;
  toneClass: string;
  layout?: OverlayControlLayout;
  size?: OverlayControlSize;
  shape?: OverlayControlShape;
  className?: string;
  children: ReactNode;
  "aria-label": string;
};

type OverlayControlAnchorProps = {
  toneClass: string;
  layout?: OverlayControlLayout;
  size?: OverlayControlSize;
  shape?: OverlayControlShape;
  className?: string;
  children: ReactNode;
} & AnchorHTMLAttributes<HTMLAnchorElement>;

type OverlayControlLabelProps = {
  toneClass: string;
  layout?: OverlayControlLayout;
  size?: OverlayControlSize;
  shape?: OverlayControlShape;
  className?: string;
  children: ReactNode;
} & LabelHTMLAttributes<HTMLLabelElement>;

export function OverlayControlButton({
  toneClass,
  layout = "icon",
  size = "md",
  shape = "square",
  className,
  children,
  type = "button",
  ...props
}: OverlayControlButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        overlayControlBase({ layout, size, shape }),
        toneClass,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function OverlayControlLink({
  href,
  toneClass,
  layout = "icon",
  size = "md",
  shape = "square",
  className,
  children,
  ...props
}: OverlayControlLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        overlayControlBase({ layout, size, shape }),
        toneClass,
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

export function OverlayControlAnchor({
  toneClass,
  layout = "action",
  size = "md",
  shape = "square",
  className,
  children,
  ...props
}: OverlayControlAnchorProps) {
  return (
    <a
      className={cn(
        overlayControlBase({ layout, size, shape }),
        toneClass,
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}

export function OverlayControlLabel({
  toneClass,
  layout = "action",
  size = "md",
  shape = "square",
  className,
  children,
  ...props
}: OverlayControlLabelProps) {
  const disabled = props["aria-disabled"] === true;
  return (
    <label
      className={cn(
        overlayControlBase({ layout, size, shape }),
        "cursor-pointer",
        disabled && "pointer-events-none opacity-50",
        toneClass,
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}
