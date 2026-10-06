import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    return NextResponse.json(
      { error: "Unable to sign out. Try again." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
