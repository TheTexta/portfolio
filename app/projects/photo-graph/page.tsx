import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";

import ProjectCaseStudyShell from "@/app/components/projects/project-case-study-shell";
import { getProject } from "@/app/components/projects/project-catalog";
import { loadGraphWithFallback } from "@/lib/photo-graph/graph-store";
import type { GraphNode } from "@/lib/photo-graph/types";
import { SITE_ORIGIN } from "@/lib/site-config";
import { buildSupabaseStorageRenderUrl } from "@/lib/supabase/config";

import PhotoGraphModelComparison from "./model-comparison/photo-graph-model-comparison";

const project = getProject("photo-graph");

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Photo Node-Gallery — Dexter Young",
  description: project.summary,
  alternates: {
    canonical: `${SITE_ORIGIN}${project.caseStudyHref}`,
  },
};

type BenchmarkReport = {
  version: 1;
  generatedAt: string;
  nodeCount: number;
  neighborsPerNode: number;
  judgmentScope: string;
  models: Array<{
    id: string;
    label: string;
    metrics: {
      precisionAtK: number;
      pairwiseAgreement: number;
      pairwiseDurationMs: number;
      graphDurationMs: number;
      pairCount: number;
      edgeCount: number;
      density: number;
      components: number;
      isolates: number;
    };
    queries: Array<{
      id: string;
      label: string;
      precisionAtK: number;
      pairwiseAgreement: number;
      neighbors: Array<{
        id: string;
        distance: number;
        judgedRelevant: boolean;
      }>;
    }>;
  }>;
};

function imageUrl(node: GraphNode) {
  if (node.storagePath) {
    return buildSupabaseStorageRenderUrl(node.storagePath, {
      width: 560,
      quality: 86,
      resize: "cover",
    });
  }

  return node.url ?? "";
}

export default async function Page() {
  const reportPath = path.join(
    process.cwd(),
    "public",
    "projects",
    "photo-graph",
    "color-model-benchmark-v1.json",
  );
  const [{ nodes }, reportRaw] = await Promise.all([
    loadGraphWithFallback(),
    readFile(reportPath, "utf8"),
  ]);
  const report = JSON.parse(reportRaw) as BenchmarkReport;
  const imageUrls = Object.fromEntries(
    nodes.map((node) => [node.id, imageUrl(node)]),
  );
  const queries =
    report.models[0]?.queries.map((query) => ({
      id: query.id,
      label: query.label,
      imageUrl: imageUrls[query.id] ?? "",
    })) ?? [];

  return (
    <ProjectCaseStudyShell
      project={project}
      sectionNavigation={{ href: "#colour-model-study", label: "Study" }}
    >
      <PhotoGraphModelComparison
        report={report}
        queries={queries}
        imageUrls={imageUrls}
      />
    </ProjectCaseStudyShell>
  );
}
