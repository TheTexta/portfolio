import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE_NAME,
  isValidAdminSessionToken,
} from "@/lib/server/admin-session";

import PhotoGraphUploadClient from "./upload-client";

export const dynamic = "force-dynamic";

export default async function PhotoGraphUploadPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  if (!isValidAdminSessionToken(token)) {
    redirect("/admin/photo-graph/login");
  }

  return <PhotoGraphUploadClient />;
}
