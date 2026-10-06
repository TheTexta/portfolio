import "server-only";

import type { User } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export function isAdminUser(user: Pick<User, "id"> | null) {
  if (!user) return false;

  const adminIds = (process.env.SUPABASE_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);

  return adminIds.includes(user.id.toLowerCase());
}

export async function getAdminUser({ readOnly = false } = {}) {
  const supabase = await createServerSupabaseClient({ readOnly });
  // Validate with Auth; never authorize from the cookie's stored user object.
  const { data, error } = await supabase.auth.getUser();

  return !error && isAdminUser(data.user) ? data.user : null;
}
