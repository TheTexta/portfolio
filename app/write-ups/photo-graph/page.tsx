import ProjectWriteUp from "@/app/components/projects/project-write-up";
import { getProject } from "@/app/components/projects/project-catalog";
import StructuredData from "@/app/components/structured-data";
import {
  createPageMetadata,
  createPageStructuredData,
  PUBLIC_PAGES,
} from "@/lib/seo";
import gallery from "@/public/projects/photo-graph/write-up/gallery.json";
import fixture from "@/public/projects/photo-graph/worked-example/fixture.json";
import { ExampleProvider } from "./_components/example-context";
import type { ExampleDataset } from "./_components/example-data";
import { describeCandidate, format } from "./_components/example-data";
import type { WorkedExample } from "./_components/example-types";
import { settleExampleLayout } from "./_components/layout-engine";

import WriteUpContent, { writeUpContents } from "./write-up.mdx";

const project = getProject("photo-graph");
// JSON imports widen tuples; the frozen-fixture tests verify every triple.
const snapshot = fixture as unknown as WorkedExample;
// Keep the 4,950-pair audit matrix server-side, outside the hydration payload.
const data: ExampleDataset = {
  version: snapshot.version,
  snapshotAt: snapshot.snapshotAt,
  queryId: snapshot.queryId,
  candidateIds: snapshot.candidateIds,
  dataset: snapshot.dataset,
  extraction: snapshot.extraction,
  config: snapshot.config,
  nodes: snapshot.nodes,
  queryRanking: snapshot.queryRanking,
  defaultGraph: snapshot.defaultGraph,
};
const positions = settleExampleLayout(data.nodes, data.defaultGraph.edges);
const harbour = describeCandidate(data, data.defaultGraph, data.config, "27");

export const metadata = createPageMetadata(PUBLIC_PAGES.photoGraph);

export default function Page() {
  return (
    <ProjectWriteUp project={project} contents={writeUpContents}>
      <StructuredData
        data={createPageStructuredData(PUBLIC_PAGES.photoGraph)}
      />
      <ExampleProvider data={data} positions={positions}>
        <WriteUpContent
          project={project}
          gallery={gallery}
          example={{
            date: new Date(data.snapshotAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }),
            harbourCiede2000: format(harbour.distance),
            harbourWeight: format(harbour.weight),
          }}
        />
      </ExampleProvider>
    </ProjectWriteUp>
  );
}
