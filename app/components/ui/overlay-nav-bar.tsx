import { ArrowRightFromLine, Maximize, Moon, SunMedium } from "lucide-react";
import { OverlayIconButton, OverlayIconLink } from "./overlay-icon-button";
import { cn } from "@/lib/cn";

type OverlayNavBarProps = {
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  expandHref?: string;
  exitHref?: string;
  toneClass: string;
  className?: string;
  iconClassName?: string;
  ariaLabel?: string;
  containerMode?: "absolute" | "sticky";
};

export default function OverlayNavBar({
  darkMode,
  onToggleDarkMode,
  expandHref,
  exitHref,
  toneClass,
  className,
  iconClassName = "h-4 w-4",
  ariaLabel = "Page controls",
  containerMode = "absolute",
}: OverlayNavBarProps) {
  const positionClass =
    containerMode === "sticky"
      ? "sticky top-[1vmin] ml-auto w-fit"
      : "absolute right-[1vmin] top-[1vmin]";

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "z-[8] flex items-center gap-2",
        positionClass,
        className,
      )}
    >
      {darkMode !== undefined && onToggleDarkMode && (
        <OverlayIconButton
          toneClass={toneClass}
          shape="round"
          onClick={onToggleDarkMode}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={darkMode}
        >
          {darkMode ? (
            <SunMedium className={iconClassName} />
          ) : (
            <Moon className={iconClassName} />
          )}
        </OverlayIconButton>
      )}

      {expandHref && (
        <OverlayIconLink
          href={expandHref}
          toneClass={toneClass}
          aria-label="Expand project to full page"
        >
          <Maximize className={iconClassName} />
        </OverlayIconLink>
      )}

      {exitHref && (
        <OverlayIconLink
          href={exitHref}
          toneClass={toneClass}
          aria-label="Exit full project view"
        >
          <ArrowRightFromLine className={iconClassName} />
        </OverlayIconLink>
      )}
    </nav>
  );
}
