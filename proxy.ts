import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { ADMIN_AUTH_COOKIE_OPTIONS } from "@/lib/supabase/auth-cookie-options";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: ADMIN_AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refresh before rendering. Each page/API still checks admin authorization.
  await supabase.auth.getClaims();
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/photo-graph/:path*"],
};
