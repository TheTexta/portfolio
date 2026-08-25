import { permanentRedirect } from "next/navigation";

import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";

export default function Page() {
  permanentRedirect(PROJECT_ROUTES.home);
}
