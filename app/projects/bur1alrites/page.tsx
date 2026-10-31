import ProjectWriteUp from "@/app/components/projects/project-write-up";
import { getProject } from "@/app/components/projects/project-catalog";
import StructuredData from "@/app/components/structured-data";
import {
  createPageMetadata,
  createPageStructuredData,
  PUBLIC_PAGES,
} from "@/lib/seo";

import WriteUpContent from "./write-up.mdx";

const project = getProject("bur1alrites");

export const metadata = createPageMetadata(PUBLIC_PAGES.bur1alrites);

export default function Page() {
  return (
    <ProjectWriteUp project={project}>
      <StructuredData
        data={createPageStructuredData(PUBLIC_PAGES.bur1alrites)}
      />
      <WriteUpContent project={project} />
    </ProjectWriteUp>
  );
}
