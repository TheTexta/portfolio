"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getProjectChrome } from "@/app/components/projects/project-chrome";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { useTheme } from "@/app/components/theme/theme-provider";
import OverlayNavBar from "@/app/components/ui/overlay-nav-bar";

type GrailedPlusPreviewProps = {
  forcedDarkMode?: boolean;
};

const CHROME_WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/grailed-plus/ipecfmmbppgpommpibaandmonmhohfnd";
const GITHUB_REPO_URL = "https://github.com/TheTexta/grailed-plus";

export default function GrailedPlusPreview({
  forcedDarkMode,
}: GrailedPlusPreviewProps) {
  const pathname = usePathname();
  const { darkMode: siteDarkMode, toggleTheme } = useTheme();

  const isFullPageRoute = pathname === PROJECT_ROUTES.grailedPlus;
  const darkMode = forcedDarkMode ?? siteDarkMode;
  const chrome = getProjectChrome("grailed-plus", darkMode);

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-[inherit] transition-colors ${chrome.shell}`}
    >
      <OverlayNavBar
        darkMode={isFullPageRoute ? darkMode : undefined}
        onToggleDarkMode={
          isFullPageRoute && forcedDarkMode === undefined
            ? toggleTheme
            : undefined
        }
        expandHref={isFullPageRoute ? undefined : PROJECT_ROUTES.grailedPlus}
        exitHref={isFullPageRoute ? PROJECT_ROUTES.home : undefined}
        toneClass={chrome.overlay}
        ariaLabel="grailed plus controls"
      />

      <div className="h-full overflow-y-auto p-4 pt-12 md:p-6 md:pt-14">
        <div className={`mx-auto w-full max-w-5xl rounded-3xl border p-4 md:p-6 ${chrome.surface}`}>
          <p className="text-[11px] uppercase tracking-[0.35em] opacity-60">
            Browser extension
          </p>
          <h3 className="mt-2 text-2xl font-semibold md:text-3xl">
            Grailed Plus
          </h3>
          <p className="mt-3 max-w-2xl text-sm opacity-80 md:text-base">
            Quick preview of Grailed Plus in action.
          </p>

          <div
            className={`relative mt-4 overflow-hidden rounded-2xl border bg-black ${darkMode ? "border-white/10" : "border-black/10"}`}
          >
            <video
              className="aspect-video w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              preload={isFullPageRoute ? "auto" : "metadata"}
              poster="/projects/grailed-plus/poster.webp"
            >
              <source
                src="/projects/grailed-plus/preview.webm"
                type="video/webm"
              />
              <source src="/projects/grailed-plus/preview.mp4" type="video/mp4" />
            </video>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={CHROME_WEB_STORE_URL}
              target="_blank"
              rel="noreferrer"
              className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.2em] transition-colors ${chrome.button}`}
            >
              Chrome Store
            </Link>
            <Link
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.2em] transition-colors ${chrome.button}`}
            >
              GitHub
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
