import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { getSpotifyRedirectUri, SPOTIFY_SCOPES } from "@/lib/spotify-auth-config";

const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!;

export function getSpotifySDK() {
  const redirectUri = getSpotifyRedirectUri();
  return SpotifyApi.withUserAuthorization(clientId, redirectUri, SPOTIFY_SCOPES);
}
