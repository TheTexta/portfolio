import ProjectWriteUp from "@/app/components/projects/project-write-up";
import { getProject } from "@/app/components/projects/project-catalog";
import StructuredData from "@/app/components/structured-data";
import {
  createPageMetadata,
  createPageStructuredData,
  PUBLIC_PAGES,
} from "@/lib/seo";

import WriteUpContent from "./write-up.mdx";

const project = getProject("elliotmairet");

export const metadata = createPageMetadata(PUBLIC_PAGES.elliotMairet);

export default function Page() {
  return (
    <ProjectWriteUp project={project}>
      <StructuredData
        data={createPageStructuredData(PUBLIC_PAGES.elliotMairet)}
      />
      <WriteUpContent project={project} />
    </ProjectWriteUp>
  );
}
