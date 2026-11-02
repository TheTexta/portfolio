import ProjectWriteUp from "@/app/components/projects/project-write-up";
import { getProject } from "@/app/components/projects/project-catalog";
import StructuredData from "@/app/components/structured-data";
import {
  createPageMetadata,
  createPageStructuredData,
  PUBLIC_PAGES,
} from "@/lib/seo";
import benchmark from "@/public/projects/photo-graph/color-model-benchmark-v1.json";
import gallery from "@/public/projects/photo-graph/write-up/gallery.json";

import WriteUpContent from "./write-up.mdx";

const project = getProject("photo-graph");
const selectedModel = benchmark.models.find(
  (model) => model.id === "mean-lab-ciede2000",
)!;
const originalModel = benchmark.models.find(
  (model) => model.id === "mean-lab-cie76",
)!;
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export const metadata = createPageMetadata(PUBLIC_PAGES.photoGraph);

export default function Page() {
  return (
    <ProjectWriteUp project={project}>
      <StructuredData
        data={createPageStructuredData(PUBLIC_PAGES.photoGraph)}
      />
      <WriteUpContent
        project={project}
        gallery={gallery}
        benchmark={{
          nodeCount: benchmark.nodeCount,
          queryCount: benchmark.queryIds.length,
          selectedPrecision: percent(selectedModel.metrics.precisionAtK),
          originalPrecision: percent(originalModel.metrics.precisionAtK),
          selectedComponents: selectedModel.metrics.components,
          originalComponents: originalModel.metrics.components,
          originalIsolates: originalModel.metrics.isolates,
        }}
      />
    </ProjectWriteUp>
  );
}
