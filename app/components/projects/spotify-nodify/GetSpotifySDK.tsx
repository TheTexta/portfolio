import { SpotifyApi } from "@spotify/web-api-ts-sdk";

const scopes = ["user-read-private"];

export function getSpotifySDK() {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!;
  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}/spotify-callback`
      : "http://localhost:3000/spotify-callback";

  return SpotifyApi.withUserAuthorization(clientId, redirectUri, scopes);
}
