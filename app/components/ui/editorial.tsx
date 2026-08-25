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
  "border-rule inline-flex min-h-11 cursor-pointer appearance-none items-center justify-center gap-2 border px-4 py-2 text-center text-xs font-semibold tracking-[0.12em] uppercase no-underline transition-[background-color,color,border-color,opacity,transform] duration-150 ease-[var(--ease-out-quint)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--color-focus))] active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary:
          "border-ink bg-ink text-canvas hover:border-[rgb(var(--color-action-hover))] hover:bg-[rgb(var(--color-action-hover))]",
        secondary: "border-rule text-ink hover:bg-surface bg-transparent",
        quiet:
          "text-ink hover:border-rule hover:bg-surface border-transparent bg-transparent px-2",
        danger:
          "border-danger text-danger hover:bg-danger hover:text-canvas bg-transparent",
      },
      size: {
        sm: "min-h-9 px-3 py-1.5 text-[0.6875rem]",
        md: "min-h-11 px-4 py-2",
        lg: "min-h-12 px-6 py-3 text-sm",
        icon: "h-11 w-11 p-0",
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
        "editorial-frame relative min-w-0 overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

export const EDITORIAL_GUTTER_CLASS = "w-full px-5 sm:px-8 lg:px-12";

export const EDITORIAL_CONTAINER_CLASS =
  "mx-auto max-w-[96rem]";

type EditorialContainerElement = "div" | "footer" | "header" | "section";

type EditorialContainerProps = HTMLAttributes<HTMLDivElement> & {
  as?: EditorialContainerElement;
};

export function EditorialGutter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(EDITORIAL_GUTTER_CLASS, className)} {...props} />
  );
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
        "editorial-rule mx-auto w-full max-w-[96rem] border-t px-5 py-14 sm:px-8 sm:py-18 lg:px-12 lg:py-24",
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
      className={cn("editorial-rule bg-surface border p-4 sm:p-5", className)}
      {...props}
    />
  );
}

export const EDITORIAL_HEADER_CONTROL_CLASS =
  "flex min-h-7 items-center outline-none transition-opacity hover:underline hover:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[rgb(var(--color-focus))] active:opacity-80";

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
        "editorial-rule bg-canvas z-40 border-b",
        sticky && "sticky top-0",
        className,
      )}
    >
      <nav
        aria-label={ariaLabel}
        className="mx-0 grid min-h-8 w-full grid-cols-[1fr_auto] items-center gap-4 px-5 text-[0.6875rem] font-semibold tracking-[0.16em] uppercase sm:grid-cols-3 sm:px-8 lg:px-4"
      >
        {leading}
        <div className="text-ink hidden min-h-7 items-center justify-center text-center text-[0.6875rem] font-semibold tracking-[0.16em] normal-case sm:flex">
          {directory}
        </div>
        <div className="flex min-h-7 items-center justify-end gap-3 sm:gap-5">
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
          className={cn(EDITORIAL_HEADER_CONTROL_CLASS, "w-fit")}
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
  "editorial-rule min-h-11 w-full border bg-canvas px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--color-focus))]";

export const EDITORIAL_LABEL_CLASS =
  "text-xs font-semibold tracking-[0.12em] uppercase";
