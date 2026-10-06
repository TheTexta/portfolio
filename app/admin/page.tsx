import { getAdminUser } from "@/lib/server/admin-auth";

import AdminLoginClient from "./login-client";
import PhotoGraphAdminClient from "./photo-graph-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getAdminUser({ readOnly: true });

  return user ? <PhotoGraphAdminClient /> : <AdminLoginClient />;
}
