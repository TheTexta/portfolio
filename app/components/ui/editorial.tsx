import { cva, type VariantProps } from "class-variance-authority";
import Link, { type LinkProps } from "next/link";
import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import HeaderDirectory from "@/app/components/ui/header-directory";

const actionStyles = cva(
  "inline-flex min-h-11 cursor-pointer appearance-none items-center justify-center gap-2 border border-rule px-4 py-2 text-center text-xs font-semibold tracking-[0.12em] uppercase no-underline transition-[background-color,color,border-color,opacity,transform] duration-150 ease-[var(--ease-out-quint)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary:
          "border-ink bg-ink text-canvas hover:border-action-hover hover:bg-action-hover",
        secondary: "border-rule bg-transparent text-ink hover:bg-surface",
        quiet:
          "border-transparent bg-transparent px-2 text-ink hover:border-rule hover:bg-surface",
        danger:
          "border-danger bg-transparent text-danger hover:bg-danger hover:text-canvas",
      },
      size: {
        sm: "min-h-9 px-3 py-1.5 text-[0.6875rem]",
        md: "min-h-11 px-4 py-2",
        lg: "min-h-12 px-6 py-3 text-sm",
        icon: "size-11 p-0",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

type ActionVariants = VariantProps<typeof actionStyles>;

export type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ActionVariants;

export function ActionButton({
  className,
  variant,
  size,
  fullWidth,
  type = "button",
  ...props
}: ActionButtonProps) {
  return (
    <button
      type={type}
      className={cn(actionStyles({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
}

type ActionLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> &
  ActionVariants & {
    href: LinkProps["href"] | string;
  };

export function ActionLink({
  className,
  variant,
  size,
  fullWidth,
  href,
  ...props
}: ActionLinkProps) {
  const hrefString = href.toString();
  const external =
    hrefString.startsWith("http://") || hrefString.startsWith("https://");

  if (external) {
    return (
      <a
        href={hrefString}
        className={cn(actionStyles({ variant, size, fullWidth }), className)}
        {...props}
      />
    );
  }

  return (
    <Link
      href={href}
      className={cn(actionStyles({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
}

export function Eyebrow({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-xs font-semibold tracking-[0.2em] uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function MediaFrame({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden border border-rule bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

export const EDITORIAL_GUTTER_CLASS = "w-full px-5 sm:px-8 lg:px-12";

export const EDITORIAL_CONTAINER_CLASS = "mx-auto max-w-[96rem]";

type EditorialContainerElement = "div" | "footer" | "header" | "section";

type EditorialContainerProps = HTMLAttributes<HTMLDivElement> & {
  as?: EditorialContainerElement;
};

export function EditorialGutter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(EDITORIAL_GUTTER_CLASS, className)} {...props} />;
}

export function EditorialContainer({
  className,
  as: Component = "div",
  ...props
}: EditorialContainerProps) {
  return (
    <Component
      className={cn(
        EDITORIAL_GUTTER_CLASS,
        EDITORIAL_CONTAINER_CLASS,
        className,
      )}
      {...props}
    />
  );
}

export function EditorialSection({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "mx-auto w-full max-w-[96rem] border-t border-rule px-5 py-14 sm:px-8 sm:py-18 lg:px-12 lg:py-24",
        className,
      )}
      {...props}
    />
  );
}

export function EditorialPanel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border border-rule bg-surface p-4 sm:p-5", className)}
      {...props}
    />
  );
}

export const EDITORIAL_HEADER_CONTROL_CLASS =
  "flex min-h-7 items-center outline-none transition-opacity hover:underline hover:opacity-55 hover:cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus active:opacity-80";

type EditorialHeaderBarProps = {
  leading: ReactNode;
  directory?: ReactNode;
  children?: ReactNode;
  className?: string;
  sticky?: boolean;
  ariaLabel?: string;
};

export function EditorialHeaderBar({
  leading,
  directory,
  children,
  className,
  sticky = false,
  ariaLabel = "Navigation",
}: EditorialHeaderBarProps) {
  return (
    <header
      className={cn(
        "z-40 border-b border-rule bg-canvas",
        sticky && "sm:sticky sm:top-0",
        className,
      )}
    >
      <nav
        aria-label={ariaLabel}
        className="mx-0 grid min-h-8 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 text-[0.6875rem] font-semibold tracking-[0.16em] uppercase sm:grid-cols-3 sm:gap-4 sm:px-8 lg:px-4"
      >
        {leading}
        <div className="hidden min-h-7 items-center justify-center text-center text-[0.6875rem] font-semibold tracking-[0.16em] text-ink normal-case sm:flex">
          {directory}
        </div>
        <div className="flex min-h-7 min-w-0 items-center justify-end gap-2 sm:gap-5">
          {children}
        </div>
      </nav>
    </header>
  );
}

type SiteHeaderProps = {
  brand?: ReactNode;
  brandHref?: string;
  directory?: ReactNode;
  children?: ReactNode;
  className?: string;
  sticky?: boolean;
  ariaLabel?: string;
};

export function SiteHeader({
  brand = "Dexter Young",
  brandHref = PROJECT_ROUTES.home,
  directory,
  children,
  className,
  sticky = true,
  ariaLabel = "Site navigation",
}: SiteHeaderProps) {
  return (
    <EditorialHeaderBar
      sticky={sticky}
      className={className}
      ariaLabel={ariaLabel}
      leading={
        <Link
          href={brandHref}
          className={cn(
            EDITORIAL_HEADER_CONTROL_CLASS,
            "w-fit min-w-0 truncate",
          )}
        >
          {brand}
        </Link>
      }
      directory={directory ?? <HeaderDirectory />}
    >
      {children}
    </EditorialHeaderBar>
  );
}

export const EDITORIAL_INPUT_CLASS =
  "border-rule min-h-11 w-full border bg-canvas px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export const EDITORIAL_LABEL_CLASS =
  "text-xs font-semibold tracking-[0.12em] uppercase";
