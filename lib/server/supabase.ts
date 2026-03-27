import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/supabase/config";
import type { SupabaseDatabase } from "@/lib/supabase/database.types";

let serviceRoleClient: SupabaseClient<SupabaseDatabase> | null = null;

export function getServiceRoleSupabase() {
  if (serviceRoleClient) {
    return serviceRoleClient;
  }

  serviceRoleClient = createClient<SupabaseDatabase>(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return serviceRoleClient;
}
