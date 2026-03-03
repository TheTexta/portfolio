"use client";

import { getSpotifySDK } from "./GetSpotifySDK";

export default function SpotifyConnectButton() {
  const connect = async () => {
    const sdk = getSpotifySDK();
    await sdk.authenticate(); // redirects to Spotify (PKCE)
  };

  return (
    <button
      onClick={connect}
      className="rounded-xl px-4 py-2 border hover:opacity-80"
    >
      Connect Spotify
    </button>
  );
}