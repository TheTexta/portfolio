export const SPOTIFY_SCOPES = ["user-read-private", "user-top-read"];

export function getSpotifyRedirectUri() {
  if (process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI) {
    return process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
  }

  return process.env.NODE_ENV !== "development"
    ? "https://dextery.dev/auth/spotify/callback"
    : "http://127.0.0.1:3000/auth/spotify/callback";
}
