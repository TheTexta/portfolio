import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { ADMIN_AUTH_COOKIE_OPTIONS } from "@/lib/supabase/auth-cookie-options";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

export async function createServerSupabaseClient({ readOnly = false } = {}) {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: ADMIN_AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        // Server Components cannot write cookies. Proxy refreshes them first.
        if (readOnly) return;

        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
