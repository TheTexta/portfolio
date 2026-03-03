"use client";

import { type UserProfile } from "@spotify/web-api-ts-sdk";
import Image from "next/image";
import { useSpotifySession } from "./useSpotifySession";

export default function SpotifyNodify() {
  const { session, connect, disconnect } = useSpotifySession();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center">
      {session.notice ? <p className="max-w-xl">{session.notice}</p> : null}

      {session.status === "checking" ? <p>Checking Spotify session...</p> : null}

      {session.status === "connected" ? (
        <>
          <p>Spotify connected.</p>
          {session.profile ? (
            <div className="flex flex-col items-center gap-2">
              {session.profile.images[0]?.url ? (
                <Image
                  src={session.profile.images[0].url}
                  alt={`${getProfileName(session.profile)} avatar`}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full border object-cover"
                />
              ) : null}
              <p>Signed in as {getProfileName(session.profile)}</p>
              <p className="text-sm opacity-80">
                Plan: {session.profile.product ?? "unknown"}
              </p>
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <button
              onClick={connect}
              className="rounded-xl border px-4 py-2 hover:opacity-80"
            >
              Reconnect Spotify
            </button>
            <button
              onClick={disconnect}
              className="rounded-xl border px-4 py-2 hover:opacity-80"
            >
              Clear Connection
            </button>
          </div>
        </>
      ) : null}

      {session.status === "disconnected" ? (
        <button
          onClick={connect}
          className="rounded-xl border px-4 py-2 hover:opacity-80"
        >
          Connect Spotify
        </button>
      ) : null}
    </div>
  );
}

function getProfileName(profile: UserProfile) {
  return profile.display_name || profile.id;
}
