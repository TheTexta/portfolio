import type { RankedPhotoGraphNeighbor } from "@/lib/photo-graph/sparse-edge-generation";
import type { PhotoGraphSparseEdgeGenerationConfig } from "@/lib/photo-graph/types";

export type Triplet = [number, number, number];

export type ExamplePhoto = {
  id: string;
  label: string;
  alt: string;
  src: string;
  width: number;
  height: number;
  rgb: Triplet;
  lab: Triplet;
  hue: number;
  longSide: number;
  source: { url: string; sha256: string; bytes: number };
  analysis: {
    width: number;
    height: number;
    pixelCount: number;
    weightSum: number;
    sums: Triplet;
    rgbaSha256: string;
    src?: string;
    pngSha256?: string;
    patch?: {
      x: number;
      y: number;
      width: number;
      height: number;
      rgba: number[];
    };
  };
};

export type ExampleEdge = { source: string; target: string; weight: number };
export type ExamplePosition = { id: string; x: number; y: number };

export type WorkedExample = {
  version: number;
  snapshotAt: string;
  queryId: string;
  candidateIds: string[];
  dataset: { idSource: string; idSourceSha256: string; description: string };
  extraction: Record<string, unknown>;
  config: PhotoGraphSparseEdgeGenerationConfig;
  nodes: ExamplePhoto[];
  pairs: {
    source: string;
    target: string;
    cie76: number;
    ciede2000: number;
  }[];
  queryRanking: { id: string; rank: number; distance: number }[];
  defaultGraph: {
    nominations: RankedPhotoGraphNeighbor[];
    edges: ExampleEdge[];
  };
};
