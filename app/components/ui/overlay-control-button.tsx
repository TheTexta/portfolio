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
        icon: "focus-visible:ring-accent/70 cursor-pointer p-0 [line-height:1] focus-visible:ring-2 focus-visible:ring-offset-0 [&_svg]:pointer-events-none [&_svg]:m-auto [&_svg]:block [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
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
      { layout: "icon", size: "sm", class: "h-7 w-7" },
      { layout: "icon", size: "md", class: "h-8 w-8" },
      { layout: "icon", size: "lg", class: "h-10 w-10" },
      { layout: "action", size: "sm", class: "px-2 py-1 text-xs" },
      { layout: "action", size: "md", class: "px-3 py-1.5 text-sm" },
      { layout: "action", size: "lg", class: "px-4 py-2 text-sm" },
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

type SharedProps = {
  toneClass: string;
  layout?: OverlayControlLayout;
  size?: OverlayControlSize;
  shape?: OverlayControlShape;
  className?: string;
  children: ReactNode;
};

type OverlayControlButtonProps = SharedProps & ButtonHTMLAttributes<HTMLButtonElement>;
type OverlayControlLinkProps = SharedProps & { href: string; "aria-label": string };
type OverlayControlAnchorProps = SharedProps & AnchorHTMLAttributes<HTMLAnchorElement>;
type OverlayControlLabelProps = SharedProps & LabelHTMLAttributes<HTMLLabelElement>;


function getOverlayControlClass({ layout = "icon", size = "md", shape = "square", toneClass, className }: SharedProps) {
  return cn(
    overlayControlBase({ layout, size, shape }),
    toneClass,
    className,
  );
}

export function OverlayControlButton({
  layout = "icon",
  size = "md",
  shape = "square",
  toneClass,
  className,
  children,
  type = "button",
  ...props
}: OverlayControlButtonProps) {
  return (
    <button
      type={type}
      className={getOverlayControlClass({ layout, size, shape, toneClass, className, children })}
      {...props}
    >
      {children}
    </button>
  );
}

export function OverlayControlLink({
  href,
  layout = "icon",
  size = "md",
  shape = "square",
  toneClass,
  className,
  children,
  ...props
}: OverlayControlLinkProps) {
  return (
    <Link
      href={href}
      className={getOverlayControlClass({ layout, size, shape, toneClass, className, children })}
      {...props}
    >
      {children}
    </Link>
  );
}

export function OverlayControlAnchor({
  layout = "action",
  size = "md",
  shape = "square",
  toneClass,
  className,
  children,
  ...props
}: OverlayControlAnchorProps) {
  return (
    <a
      className={getOverlayControlClass({ layout, size, shape, toneClass, className, children })}
      {...props}
    >
      {children}
    </a>
  );
}

export function OverlayControlLabel({
  layout = "action",
  size = "md",
  shape = "square",
  toneClass,
  className,
  children,
  ...props
}: OverlayControlLabelProps) {
  const disabled = props["aria-disabled"] === true;
  return (
    <label
      className={cn(
        getOverlayControlClass({ layout, size, shape, toneClass, className, children }),
        "cursor-pointer",
        disabled && "pointer-events-none opacity-50"
      )}
      {...props}
    >
      {children}
    </label>
  );
}
