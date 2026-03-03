"use client";

import { type UserProfile } from "@spotify/web-api-ts-sdk";
import { useEffect, useState } from "react";
import { getSpotifySDK } from "@/lib/GetSpotifySDK";

type SessionStatus = "checking" | "connected" | "disconnected";

export type SpotifySessionState = {
  status: SessionStatus;
  notice: string | null;
  profile: UserProfile | null;
};

export function useSpotifySession() {
  const [session, setSession] = useState<SpotifySessionState>({
    status: "checking",
    notice: null,
    profile: null,
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
          });
          return;
        }

        const profile = await sdk.currentUser.profile();

        if (!isMounted) {
          return;
        }

        setSession({
          status: "connected",
          notice: savedNotice,
          profile,
        });
      } catch {
        sdk.logOut();

        if (!isMounted) {
          return;
        }

        setSession({
          status: "disconnected",
          notice: "Spotify connected, but profile fetch failed.",
          profile: null,
        });
      }
    }

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function connect() {
    const sdk = getSpotifySDK();
    await sdk.authenticate();
  }

  function disconnect() {
    const sdk = getSpotifySDK();
    sdk.logOut();

    setSession({
      status: "disconnected",
      notice: "Spotify connection cleared.",
      profile: null,
    });
  }

  return {
    session,
    connect,
    disconnect,
  };
}

function consumeSpotifyAuthNotice() {
  const savedNotice = localStorage.getItem("spotify_auth_notice");

  if (!savedNotice) {
    return null;
  }

  localStorage.removeItem("spotify_auth_notice");

  if (savedNotice.startsWith("error:")) {
    return `Spotify auth error: ${savedNotice.replace("error:", "")}`;
  }

  if (savedNotice === "connected") {
    return "Spotify connected.";
  }

  return savedNotice;
}
