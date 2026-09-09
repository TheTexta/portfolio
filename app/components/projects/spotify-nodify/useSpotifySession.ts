"use client";

import { type Track, type UserProfile } from "@spotify/web-api-ts-sdk";
import { useEffect, useState } from "react";
import { getSpotifySDK } from "@/lib/GetSpotifySDK";

type SessionStatus = "checking" | "connecting" | "connected" | "disconnected";

export type SpotifySessionState = {
  status: SessionStatus;
  notice: string | null;
  profile: UserProfile | null;
  topTracks: Track[];
};

export function useSpotifySession() {
  const [session, setSession] = useState<SpotifySessionState>({
    status: "checking",
    notice: null,
    profile: null,
    topTracks: [],
  });

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      const savedNotice = consumeSpotifyAuthNotice();
      const sdk = getSpotifySDK();

      try {
        const token = await sdk.getAccessToken();
        const isConnected = Boolean(token?.access_token);

        if (!isConnected) {
          if (!isMounted) {
            return;
          }

          setSession({
            status: "disconnected",
            notice: savedNotice,
            profile: null,
            topTracks: [],
          });
          return;
        }

        const [profileResult, topTracksResult] = await Promise.allSettled([
          sdk.currentUser.profile(),
          sdk.currentUser.topItems("tracks", "short_term", 10),
        ]);

        if (profileResult.status !== "fulfilled") {
          throw profileResult.reason;
        }

        if (!isMounted) {
          return;
        }

        setSession({
          status: "connected",
          notice:
            topTracksResult.status === "fulfilled"
              ? savedNotice
              : mergeNotices(
                  savedNotice,
                  "Reconnect Spotify to load your top tracks from the past month.",
                ),
          profile: profileResult.value,
          topTracks:
            topTracksResult.status === "fulfilled"
              ? topTracksResult.value.items
              : [],
        });
      } catch {
        safelyLogOut(sdk);

        if (!isMounted) {
          return;
        }

        setSession({
          status: "disconnected",
          notice: "Spotify connected, but profile fetch failed.",
          profile: null,
          topTracks: [],
        });
      }
    }

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function connect() {
    if (session.status === "connecting") {
      return;
    }

    const sdk = getSpotifySDK();
    setSession((currentSession) => ({
      ...currentSession,
      status: "connecting",
      notice: null,
    }));

    try {
      await sdk.authenticate();
    } catch (error) {
      safelyLogOut(sdk);
      setSession((currentSession) => ({
        ...currentSession,
        status: "disconnected",
        notice: getSpotifyErrorNotice(error),
      }));
    }
  }

  function disconnect() {
    const sdk = getSpotifySDK();
    safelyLogOut(sdk);

    setSession({
      status: "disconnected",
      notice: "Spotify connection cleared.",
      profile: null,
      topTracks: [],
    });
  }

  return {
    session,
    connect,
    disconnect,
  };
}

function consumeSpotifyAuthNotice() {
  let savedNotice: string | null;

  try {
    savedNotice = localStorage.getItem("spotify_auth_notice");

    if (savedNotice) {
      localStorage.removeItem("spotify_auth_notice");
    }
  } catch {
    return "Spotify session storage is unavailable. Enable site storage to connect Spotify.";
  }

  if (!savedNotice) {
    return null;
  }

  if (savedNotice.startsWith("error:")) {
    return `Spotify auth error: ${savedNotice.replace("error:", "")}`;
  }

  if (savedNotice === "connected") {
    return "Spotify connected.";
  }

  return savedNotice;
}

function mergeNotices(primary: string | null, secondary: string) {
  return primary ? `${primary} ${secondary}` : secondary;
}

function safelyLogOut(sdk: ReturnType<typeof getSpotifySDK>) {
  try {
    sdk.logOut();
  } catch {}
}

function getSpotifyErrorNotice(error: unknown) {
  if (error instanceof DOMException && error.name === "SecurityError") {
    return "Spotify needs browser storage access to connect.";
  }

  if (error instanceof Error && error.message) {
    return `Spotify connection failed: ${error.message}`;
  }

  return "Spotify connection failed. Try again.";
}
