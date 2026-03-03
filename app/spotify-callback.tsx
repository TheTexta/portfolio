"use client";

import { useEffect, useState } from "react";
import { getSpotifySDK } from "./components/projects/spotify-nodify/GetSpotifySDK";

export default function SpotifyCallbackPage() {
  const [status, setStatus] = useState("Finishing Spotify login...");

  useEffect(() => {
    (async () => {
      try {
        const sdk = getSpotifySDK();

        // Depending on SDK version, this may be unnecessary because
        // authenticate() completes the flow automatically on redirect.
        // But calling a simple endpoint right away ensures tokens are ready.
        const me = await sdk.currentUser.profile();

        setStatus(`Connected as ${me.display_name ?? "Spotify user"} ✅`);
      } catch (e) {
        console.error(e);
        setStatus("Spotify login failed ❌ (check redirect URI + scopes)");
      }
    })();
  }, []);

  return <main className="p-6">{status}</main>;
}