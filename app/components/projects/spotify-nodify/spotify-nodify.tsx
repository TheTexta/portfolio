"use client";

import { type Track, type UserProfile } from "@spotify/web-api-ts-sdk";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "@/app/components/theme/theme-provider";
import { getProjectChrome } from "@/app/components/projects/project-chrome";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import OverlayNavBar from "@/app/components/ui/overlay-nav-bar";
import { useSpotifySession } from "./useSpotifySession";

type SpotifyNodifyProps = {
  forcedDarkMode?: boolean;
};

export default function SpotifyNodify({
  forcedDarkMode,
}: SpotifyNodifyProps) {
  const { session, connect, disconnect } = useSpotifySession();
  const { darkMode: siteDarkMode, toggleTheme } = useTheme();
  const pathname = usePathname();
  const isFullPageRoute = pathname === PROJECT_ROUTES.spotifyNodify;
  const visibleTracks = session.topTracks.slice(0, isFullPageRoute ? 10 : 5);
  const darkMode = forcedDarkMode ?? siteDarkMode;
  const chrome = getProjectChrome("spotify", darkMode);

  const projectPath = PROJECT_ROUTES.spotifyNodify;

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-[inherit] transition-colors ${chrome.shell}`}
    >
      <OverlayNavBar
        darkMode={isFullPageRoute ? darkMode : undefined}
        onToggleDarkMode={
          isFullPageRoute && forcedDarkMode === undefined ? toggleTheme : undefined
        }
        expandHref={isFullPageRoute ? undefined : projectPath}
        exitHref={isFullPageRoute ? PROJECT_ROUTES.home : undefined}
        toneClass={chrome.overlay}
        ariaLabel="spotify-nodify controls"
      />

      <div className="h-full overflow-y-auto p-4 pt-12 md:p-6 md:pt-14">
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center gap-5">
          <div className="text-left">
            <p className="text-[11px] uppercase tracking-[0.35em] opacity-60">
              Spotify API experiment
            </p>
            <h3 className="mt-2 text-2xl font-semibold md:text-3xl">
              spotify-nodify
            </h3>
            <p className="mt-2 max-w-2xl text-sm opacity-80 md:text-base">
              Connect Spotify and inspect your profile plus recent listening
              taste. Preview mode stays compact, and the expanded view exposes
              the full top 10 list.
            </p>
          </div>

          {session.notice ? (
            <p className="max-w-2xl text-sm opacity-80">{session.notice}</p>
          ) : null}

          {session.status === "checking" ? (
            <div
              className={`rounded-3xl border p-5 text-sm md:p-6 ${chrome.surface}`}
            >
              Checking Spotify session...
            </div>
          ) : null}

          {session.status === "connected" && session.profile ? (
            <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
              <section
                className={`rounded-3xl border p-5 text-center md:p-6 lg:text-left ${chrome.surface}`}
              >
                <div className="flex flex-col items-center gap-4 lg:items-start">
                  {session.profile.images[0]?.url ? (
                    <Image
                      src={session.profile.images[0].url}
                      alt={`${getProfileName(session.profile)} avatar`}
                      width={112}
                      height={112}
                      className={`h-28 w-28 rounded-full border object-cover ${chrome.avatar}`}
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-full border border-dashed text-3xl opacity-60">
                      {getProfileInitials(session.profile)}
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-lg font-medium">
                      {getProfileName(session.profile)}
                    </p>
                    <p className="text-sm opacity-75">
                      Plan: {session.profile.product ?? "unknown"}
                    </p>
                    <p className="text-sm opacity-75">
                      Showing {visibleTracks.length} of {session.topTracks.length || 10} top
                      tracks
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
                    <button
                      onClick={connect}
                      className={`rounded-full border px-4 py-2 text-sm transition-colors ${chrome.button}`}
                    >
                      Reconnect Spotify
                    </button>
                    <button
                      onClick={disconnect}
                      className={`rounded-full border px-4 py-2 text-sm transition-colors ${chrome.button}`}
                    >
                      Clear Connection
                    </button>
                  </div>
                </div>
              </section>

              <section className={`rounded-3xl border p-5 md:p-6 ${chrome.surface}`}>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.3em] opacity-60">
                      Past month
                    </p>
                    <h4 className="mt-2 text-xl font-semibold">
                      Top tracks
                    </h4>
                  </div>
                  {!isFullPageRoute ? (
                    <p className="text-xs opacity-60">Expand for full list</p>
                  ) : null}
                </div>

                {visibleTracks.length > 0 ? (
                  <ol className="mt-4 space-y-3">
                    {visibleTracks.map((track, index) => (
                      <li
                        key={track.id}
                        className={`grid grid-cols-[auto,1fr] items-start gap-3 rounded-2xl border px-3 py-3 md:px-4 ${chrome.item}`}
                      >
                        <span className="pt-0.5 text-xs font-semibold uppercase tracking-[0.2em] opacity-50">
                          {(index + 1).toString().padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{track.name}</p>
                          <p className="truncate text-sm opacity-75">
                            {getArtistNames(track)}
                          </p>
                          <p className="truncate text-xs opacity-50">
                            {track.album.name}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div
                    className={`mt-4 rounded-2xl border border-dashed px-4 py-6 text-sm opacity-75 ${chrome.emptyState}`}
                  >
                    No past-month top tracks available yet.
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {session.status === "disconnected" ? (
            <section
              className={`rounded-3xl border p-6 text-left md:p-7 ${chrome.surface}`}
            >
              <p className="text-sm uppercase tracking-[0.25em] opacity-60">
                Connection required
              </p>
              <p className="mt-3 max-w-2xl text-sm opacity-80 md:text-base">
                Authorize Spotify to render your profile image and your top
                tracks from the last month directly inside the project preview.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={connect}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${chrome.button}`}
                >
                  Connect Spotify
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function getProfileName(profile: UserProfile) {
  return profile.display_name || profile.id;
}

function getProfileInitials(profile: UserProfile) {
  return getProfileName(profile)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getArtistNames(track: Track) {
  return track.artists.map((artist) => artist.name).join(", ");
}
