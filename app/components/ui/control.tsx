import { cva } from "class-variance-authority";
import Link from "next/link";
import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

const controlBase = cva(
  "border-rule bg-canvas text-ink hover:bg-surface inline-flex cursor-pointer appearance-none items-center justify-center border transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out-quint)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--color-focus))] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      layout: {
        icon: "cursor-pointer p-0 [line-height:1] [&_svg]:pointer-events-none [&_svg]:m-auto [&_svg]:block [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
        action: "gap-2 leading-none font-semibold tracking-[0.08em] uppercase",
      },
      size: {
        sm: "",
        md: "",
        lg: "",
      },
      shape: {
        square: "",
        round: "rounded-full",
      },
    },
    compoundVariants: [
      { layout: "icon", size: "sm", class: "h-8 w-8" },
      { layout: "icon", size: "md", class: "h-10 w-10" },
      { layout: "icon", size: "lg", class: "h-11 w-11" },
      {
        layout: "action",
        size: "sm",
        class: "min-h-9 px-2.5 py-1.5 text-[0.625rem]",
      },
      {
        layout: "action",
        size: "md",
        class: "min-h-11 px-3 py-2 text-[0.6875rem]",
      },
      {
        layout: "action",
        size: "lg",
        class: "min-h-12 px-4 py-2.5 text-xs",
      },
    ],
    defaultVariants: {
      layout: "icon",
      size: "md",
      shape: "square",
    },
  },
);

type ControlLayout = "icon" | "action";
type ControlShape = "square" | "round";
type ControlSize = "sm" | "md" | "lg";

export const CONTROL_ICON_CLASS = "";
export const CONTROL_ACTION_CLASS = "";
export const CONTROL_DANGER_CLASS =
  "border-danger bg-danger text-canvas hover:bg-danger/85";

type SharedProps = {
  toneClass?: string;
  layout?: ControlLayout;
  size?: ControlSize;
  shape?: ControlShape;
  className?: string;
  children: ReactNode;
};

type ControlButtonProps = SharedProps & ButtonHTMLAttributes<HTMLButtonElement>;
type ControlLinkProps = SharedProps & {
  href: string;
  "aria-label": string;
};
type ControlAnchorProps = SharedProps & AnchorHTMLAttributes<HTMLAnchorElement>;
type ControlLabelProps = SharedProps & LabelHTMLAttributes<HTMLLabelElement>;

function getControlClass({
  layout = "icon",
  size = "md",
  shape = "square",
  toneClass,
  className,
}: SharedProps) {
  return cn(controlBase({ layout, size, shape }), toneClass, className);
}

export function ControlButton({
  layout = "icon",
  size = "sm",
  shape = "square",
  toneClass,
  className,
  children,
  type = "button",
  ...props
}: ControlButtonProps) {
  return (
    <button
      type={type}
      className={getControlClass({
        layout,
        size,
        shape,
        toneClass,
        className,
        children,
      })}
      {...props}
    >
      {children}
    </button>
  );
}

export function ControlLink({
  href,
  layout = "icon",
  size = "md",
  shape = "square",
  toneClass,
  className,
  children,
  ...props
}: ControlLinkProps) {
  return (
    <Link
      href={href}
      className={getControlClass({
        layout,
        size,
        shape,
        toneClass,
        className,
        children,
      })}
      {...props}
    >
      {children}
    </Link>
  );
}

export function ControlAnchor({
  layout = "action",
  size = "md",
  shape = "square",
  toneClass,
  className,
  children,
  ...props
}: ControlAnchorProps) {
  return (
    <a
      className={getControlClass({
        layout,
        size,
        shape,
        toneClass,
        className,
        children,
      })}
      {...props}
    >
      {children}
    </a>
  );
}

export function ControlLabel({
  layout = "action",
  size = "md",
  shape = "square",
  toneClass,
  className,
  children,
  ...props
}: ControlLabelProps) {
  const disabled = props["aria-disabled"] === true;

  return (
    <label
      className={cn(
        getControlClass({
          layout,
          size,
          shape,
          toneClass,
          className,
          children,
        }),
        "cursor-pointer",
        disabled && "pointer-events-none opacity-50",
      )}
      {...props}
    >
      {children}
    </label>
  );
}
