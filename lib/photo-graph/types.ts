export type OklabColor = [number, number, number];

export type PhotoGraphPaletteEntry = {
  color: OklabColor;
  weight: number;
};

export type PhotoGraphColorFeatureV1 = {
  version: 1;
  sampleCount: number;
  meanOklab: OklabColor;
  histogram: number[];
  palette: PhotoGraphPaletteEntry[];
};

export type GraphFeature = {
  rgb: [number, number, number];
  lab: [number, number, number];
  hue: number;
  longSide: number;
  colorV1?: PhotoGraphColorFeatureV1;
};

export type PhotoGraphSimilarityModelId =
  | "mean-lab-cie76"
  | "mean-lab-ciede2000"
  | "mean-oklab"
  | "oklab-histogram"
  | "oklab-palette-emd";

export type PhotoGraphSparseEdgeGenerationConfig = {
  version: 2;
  model: PhotoGraphSimilarityModelId;
  neighborsPerNode: number;
  maxDistance: number;
};

export type LabEdgeGenerationParams = {
  sigmaE: number;
  minCorrelation: number;
};

export type PhotoGraphEdgeGenerationConfig = PhotoGraphSparseEdgeGenerationConfig;

export type PhotoGraphNeighborRow = {
  source_node_id: number;
  target_node_id: number;
  model: PhotoGraphSimilarityModelId;
  feature_version: number;
  distance: number;
  correlation: number;
  rank: number;
  updated_at: string;
};

export type PhotoGraphRuntimeControls = {
  hideConnections: boolean;
  chargeMult: number;
  collideBoxScale: number;
  collideIterations: number;
  collidePad: number;
  collideStrength: number;
  distMinMult: number;
  distMaxMult: number;
};

export type PhotoGraphNumericControlKey = Exclude<
  keyof PhotoGraphRuntimeControls,
  "hideConnections"
>;

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

export type GraphLoadSource = "database" | "static";

export type PublicGraphNode = Omit<GraphNode, "feature">;

export type PhotoGraphPayloadNode = {
  id: string;
  sourceUrl: string;
  storagePath?: string;
  baseSize: number;
  aspectRatio: number;
  hasKnownAspectRatio: boolean;
  layerNoise: number;
  w: number;
  h: number;
  renderArea: number;
};

export type PhotoGraphPayloadLink = {
  source: string;
  target: string;
  value: number;
  baseValue: number;
};

export type PhotoGraphPayload = {
  nodes: PhotoGraphPayloadNode[];
  links: PhotoGraphPayloadLink[];
};

export type PhotoGraphPayloadResponse = PhotoGraphPayload & {
  defaultGraphControls?: PhotoGraphRuntimeControls;
};

export type PhotoGraphNodeRow = {
  id: number;
  scale: number;
  colour: string;
  storage_path: string | null;
  external_url: string | null;
  feature_rgb_r: number | null;
  feature_rgb_g: number | null;
  feature_rgb_b: number | null;
  feature_lab_l: number | null;
  feature_lab_a: number | null;
  feature_lab_b: number | null;
  feature_hue: number | null;
  feature_long_side: number | null;
  feature_color_v1: PhotoGraphColorFeatureV1 | null;
  image_width: number | null;
  image_height: number | null;
  image_aspect_ratio: number | null;
  created_at?: string;
  updated_at: string;
};

export type PhotoGraphEdgeRow = {
  left_node_id: number;
  right_node_id: number;
  correlation: number;
  created_at?: string;
  updated_at: string;
};

export type PhotoGraphSettingRow = {
  key: string;
  value: unknown;
  updated_at: string;
};
