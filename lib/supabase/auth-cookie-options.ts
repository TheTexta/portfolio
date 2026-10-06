import "server-only";

import type { CookieOptionsWithName } from "@supabase/ssr";

// Admin authentication stays server-side, separate from the upload client.
export const ADMIN_AUTH_COOKIE_OPTIONS: CookieOptionsWithName = {
  name: "photo_graph_supabase_auth",
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
