"use client";
import Link from "next/link";
import { getProjectChrome } from "@/app/components/projects/project-chrome";
import { useTheme } from "@/app/components/theme/theme-provider";

type GrailedPlusPreviewProps = {
  forcedDarkMode?: boolean;
};

const CHROME_WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/grailed-plus/ipecfmmbppgpommpibaandmonmhohfnd";
const GITHUB_REPO_URL = "https://github.com/TheTexta/grailed-plus";

export default function GrailedPlusPreview({
  forcedDarkMode,
}: GrailedPlusPreviewProps) {
  const { darkMode: siteDarkMode } = useTheme();
  const darkMode = forcedDarkMode ?? siteDarkMode;
  const chrome = getProjectChrome("grailed-plus", darkMode);

  return (
    <section
      className={`h-full w-full overflow-y-auto p-4 transition-colors md:p-6 ${chrome.shell}`}
    >
      <p className="text-[11px] uppercase tracking-[0.35em] opacity-60">
        Browser extension
      </p>
      <h3 className="mt-2 text-2xl font-semibold md:text-3xl">Grailed Plus</h3>
      <p className="mt-3 max-w-2xl text-sm opacity-80 md:text-base">
        Quick preview of Grailed Plus in action.
      </p>

      <video
        className={`mt-4 aspect-video w-full rounded-2xl border bg-black object-cover ${darkMode ? "border-white/10" : "border-black/10"}`}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster="/projects/grailed-plus/poster.webp"
      >
        <source src="/projects/grailed-plus/preview.webm" type="video/webm" />
        <source src="/projects/grailed-plus/preview.mp4" type="video/mp4" />
      </video>

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
    </section>
  );
}
