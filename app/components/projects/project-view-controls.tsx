import Link from "next/link";

import { ArrowRightFromLine, Maximize, Menu } from "lucide-react";

type ProjectViewControlsProps = {
  menuOpen: boolean;
  onOpenMenu: () => void;
  isFullPage: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  toneClass: string;
  expandHref: string;
  exitHref: string;
};

const overlayControlClass = "cursor-pointer px-1.5 backdrop-blur-[2px]";

export default function ProjectViewControls({
  menuOpen,
  onOpenMenu,
  isFullPage,
  darkMode,
  onToggleDarkMode,
  toneClass,
  expandHref,
  exitHref,
}: ProjectViewControlsProps) {
  return (
    <nav className="absolute left-[1vmin] right-[1vmin] top-[1vmin] z-5 flex h-8 items-center">
      {!menuOpen && (
        <button
          onClick={onOpenMenu}
          className={`flex h-8 w-8 items-center justify-center rounded-md ${overlayControlClass} ${toneClass}`}
          aria-label="Open graph controls"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      <div className="ml-auto flex h-full items-center gap-2">
        {isFullPage && (
          <button
            onClick={onToggleDarkMode}
            className={`flex h-8 w-8 items-center justify-center rounded-full ${overlayControlClass} ${toneClass}`}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={darkMode}
          >
            {darkMode ? "◐" : "◑"}
          </button>
        )}

        {isFullPage ? (
          <Link
            href={exitHref}
            className={`flex h-8 w-8 items-center justify-center rounded-md ${overlayControlClass} ${toneClass}`}
            aria-label="Exit full project view"
          >
            <ArrowRightFromLine className="h-4 w-4" />
          </Link>
        ) : (
          <Link
            href={expandHref}
            className={`flex h-8 w-8 items-center justify-center rounded-md ${overlayControlClass} ${toneClass}`}
            aria-label="Expand project to full page"
          >
            <Maximize className="h-4 w-4" />
          </Link>
        )}
      </div>
    </nav>
  );
}