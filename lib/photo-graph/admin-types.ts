import type {
  GraphFeature,
  GraphImageDimensions,
  PhotoGraphEdgeGenerationConfig,
  PhotoGraphRuntimeControls,
} from "./types";

export type PhotoGraphUploadResponse = {
  ok: boolean;
  createdIds: string[];
  nodeCount: number;
  edgeCount: number;
  edgeGenerationConfig: PhotoGraphEdgeGenerationConfig;
  error?: string;
};

export type PhotoGraphUploadUrlResponse = {
  ok: boolean;
  bucket: string;
  objectPath: string;
  token: string;
  signedUrl: string;
  expiresInSeconds: number;
  error?: string;
};

export type AdminPhotoGraphNode = {
  id: string;
  scale?: number;
  colour?: string;
  storagePath?: string;
  url?: string;
  previewUrl?: string;
  correlations: Record<string, number>;
  feature?: GraphFeature;
  dimensions?: GraphImageDimensions;
};

export type AdminPhotoGraphResponse = {
  source: "database" | "static";
  nodes: AdminPhotoGraphNode[];
  writesEnabled: boolean;
  defaultEdgeGeneration: PhotoGraphEdgeGenerationConfig;
  defaultGraphControls: PhotoGraphRuntimeControls;
  error?: string;
};

export type SaveEdgeDefaultsResponse = {
  ok: boolean;
  source: "database" | "static";
  edgeCount: number;
  config: PhotoGraphEdgeGenerationConfig;
  error?: string;
};

export type SaveGraphDefaultsResponse = {
  ok: boolean;
  controls: PhotoGraphRuntimeControls;
  error?: string;
};

export type DeletePhotoGraphResponse = {
  ok: boolean;
  deletedId: string;
  nodeCount: number;
  error?: string;
};

export type PhotoGraphUploadRegistration = {
  storagePath: string;
  feature: GraphFeature;
  dimensions: GraphImageDimensions;
};
