import ProjectWriteUp from "@/app/components/projects/project-write-up";
import { getProject } from "@/app/components/projects/project-catalog";
import StructuredData from "@/app/components/structured-data";
import {
  createPageMetadata,
  createPageStructuredData,
  PUBLIC_PAGES,
} from "@/lib/seo";

import WriteUpContent from "./write-up.mdx";

const project = getProject("tvm-discord-bot");
const page = PUBLIC_PAGES.tvmDiscordBot;

export const metadata = createPageMetadata(page);

export default function Page() {
  return (
    <ProjectWriteUp project={project}>
      <StructuredData data={createPageStructuredData(page)} />
      <WriteUpContent project={project} />
    </ProjectWriteUp>
  );
}
