"use client";

import { type Track, type UserProfile } from "@spotify/web-api-ts-sdk";
import { cva } from "class-variance-authority";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { ControlButton } from "@/app/components/ui/control";
import ExperienceNav from "@/app/components/ui/experience-nav";
import { cn } from "@/lib/cn";
import { useSpotifySession } from "./useSpotifySession";

type SpotifyNodifyProps = {
  forcedDarkMode?: boolean;
  showNavigation?: boolean;
  compact?: boolean;
};

const spotifyShell = cva(
  "bg-canvas text-ink relative h-full w-full overflow-hidden transition-colors",
);
const spotifySurface = cva("editorial-rule bg-surface border", {
  variants: {
    spacing: {
      base: "p-5 md:p-6",
      roomy: "p-6 md:p-7",
    },
    alignment: {
      left: "text-left",
      profile: "text-center lg:text-left",
    },
  },
  defaultVariants: {
    spacing: "base",
    alignment: "left",
  },
});
const spotifyTrackItem = cva(
  "editorial-rule grid grid-cols-[auto,1fr] items-start gap-3 border-b px-3 py-3 last:border-b-0 md:px-4",
);
const spotifyEmptyState = cva(
  "editorial-rule text-muted mt-4 border border-dashed px-4 py-6 text-sm",
);

export default function SpotifyNodify({
  showNavigation = true,
  compact = false,
}: SpotifyNodifyProps) {
  const { session, connect, disconnect } = useSpotifySession();
  const pathname = usePathname();
  const isFullPageRoute = pathname === PROJECT_ROUTES.spotifyNodifyExperience;
  const visibleTracks = session.topTracks.slice(
    0,
    isFullPageRoute && !compact ? 10 : 5,
  );

  return (
    <div className={spotifyShell()}>
      {showNavigation ? (
        <ExperienceNav
          showTheme={isFullPageRoute}
          caseStudyHref={
            isFullPageRoute ? PROJECT_ROUTES.spotifyNodify : undefined
          }
          experienceHref={
            isFullPageRoute ? undefined : PROJECT_ROUTES.spotifyNodifyExperience
          }
          ariaLabel="Spotify Nodify controls"
        />
      ) : null}

      <div className="h-full overflow-y-auto p-4 pt-12 md:p-6 md:pt-14">
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center gap-5">
          <div className="text-left">
            <p className="text-[11px] tracking-[0.35em] uppercase opacity-60">
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
            <div className={cn(spotifySurface(), "text-sm")}>
              Checking Spotify session...
            </div>
          ) : null}

          {session.status === "connected" && session.profile ? (
            <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
              <section className={cn(spotifySurface({ alignment: "profile" }))}>
                <div className="flex flex-col items-center gap-4 lg:items-start">
                  {session.profile.images[0]?.url ? (
                    <Image
                      src={session.profile.images[0].url}
                      alt={`${getProfileName(session.profile)} avatar`}
                      width={112}
                      height={112}
                      className="editorial-rule h-28 w-28 rounded-full border object-cover"
                    />
                  ) : (
                    <div className="editorial-rule text-muted flex h-28 w-28 items-center justify-center rounded-full border border-dashed text-3xl">
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
                      Showing {visibleTracks.length} of{" "}
                      {session.topTracks.length || 10} top tracks
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
                    <ControlButton onClick={connect} layout="action">
                      Reconnect Spotify
                    </ControlButton>
                    <ControlButton onClick={disconnect} layout="action">
                      Clear Connection
                    </ControlButton>
                  </div>
                </div>
              </section>

              <section className={spotifySurface()}>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] tracking-[0.3em] uppercase opacity-60">
                      Past month
                    </p>
                    <h4 className="mt-2 text-xl font-semibold">Top tracks</h4>
                  </div>
                  {!isFullPageRoute ? (
                    <p className="text-xs opacity-60">Expand for full list</p>
                  ) : null}
                </div>

                {visibleTracks.length > 0 ? (
                  <ol className="editorial-rule mt-4 border-y">
                    {visibleTracks.map((track, index) => (
                      <li key={track.id} className={spotifyTrackItem()}>
                        <span className="pt-0.5 text-xs font-semibold tracking-[0.2em] uppercase opacity-50">
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
                  <div className={spotifyEmptyState()}>
                    No past-month top tracks available yet.
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {session.status === "disconnected" ? (
            <section className={cn(spotifySurface({ spacing: "roomy" }))}>
              <p className="text-sm tracking-[0.25em] uppercase opacity-60">
                Connection required
              </p>
              <p className="mt-3 max-w-2xl text-sm opacity-80 md:text-base">
                Authorize Spotify to render your profile image and your top
                tracks from the last month directly inside the project preview.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <ControlButton onClick={connect} layout="action">
                  Connect Spotify
                </ControlButton>
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
