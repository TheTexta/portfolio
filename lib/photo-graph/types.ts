export type GraphFeature = {
  rgb: [number, number, number];
  lab: [number, number, number];
  hue: number;
  longSide: number;
};

export type GraphImageDimensions = {
  width: number;
  height: number;
  aspectRatio: number;
};

export type GraphNode = {
  id: string;
  scale: number;
  colour: string;
  correlations: Record<string, number>;
  storagePath?: string;
  feature?: GraphFeature;
  dimensions?: GraphImageDimensions;
  url?: string;
};

export type GraphLoadSource = "runtime" | "static";

export type PhotoGraphJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type PhotoGraphJobDocument = {
  status: PhotoGraphJobStatus;
  newNodeIds: string[];
  progress: number;
  totalComparisons: number;
  doneComparisons: number;
  pairCursor: number;
  createdAtMs: number;
  updatedAtMs: number;
  errorMessage?: string;
};

export type PublicGraphNode = Omit<GraphNode, "feature">;
