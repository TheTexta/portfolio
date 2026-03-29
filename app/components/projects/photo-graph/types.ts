import type {
  ForceGraphMethods,
  LinkObject,
  NodeObject,
} from "react-force-graph-2d";

import type {
  PhotoGraphRuntimeControls,
  PhotoGraphPayloadLink,
  PhotoGraphPayloadNode,
} from "@/lib/photo-graph/types";

type PhotoGraphNodeRuntimeState = {
  image?: HTMLImageElement;
  loadedWidth?: number;
};

export type PhotoGraphNode = NodeObject<
  PhotoGraphPayloadNode & PhotoGraphNodeRuntimeState
> &
  PhotoGraphPayloadNode &
  PhotoGraphNodeRuntimeState;

type PhotoGraphLinkBase = {
  source: string | PhotoGraphNode;
  target: string | PhotoGraphNode;
  value: number;
  baseValue: number;
};

export type PhotoGraphLink = LinkObject<PhotoGraphNode, PhotoGraphLinkBase> &
  PhotoGraphLinkBase;

export type PhotoGraphData = {
  nodes: PhotoGraphNode[];
  links: PhotoGraphLink[];
};

export type PhotoGraphInstance = ForceGraphMethods<
  PhotoGraphNode,
  PhotoGraphLink
>;

export type RuntimeForce = Parameters<PhotoGraphInstance["d3Force"]>[1];

export type RectangleCollisionForce = {
  (alpha: number): void;
  initialize: (nodes: PhotoGraphNode[] | ArrayLike<PhotoGraphNode>) => void;
};

export type GraphTransform = { k: number; x: number; y: number };

export type PhotoGraphCanvasProps = {
  controls?: GraphControls;
  defaultControls?: GraphControls;
  forcedDarkMode?: boolean;
  fitToCanvas?: boolean;
  graphUrl?: string;
  onControlsChange?: (controls: GraphControls) => void;
  showControls?: boolean;
  showNavigation?: boolean;
};

export type GraphControls = PhotoGraphRuntimeControls;

export type GraphSliderConfig = {
  key: Exclude<keyof GraphControls, "hideConnections">;
  label: string;
  min: number;
  max: number;
  scale?: number;
  formatValue: (value: number) => string;
};

export type InspectTarget = {
  id: string;
  originalUrl: string;
  previewUrl: string;
};

export type InspectMetadata = {
  resolution: { width: number; height: number } | null;
  sizeMb: number | null;
  downloadUrl: string | null;
  filename: string;
};

export function toPhotoGraphData(
  payload: Readonly<{
    nodes: PhotoGraphPayloadNode[];
    links: PhotoGraphPayloadLink[];
  }>,
): PhotoGraphData {
  return {
    nodes: payload.nodes.map((node) => ({ ...node })),
    links: payload.links.map((link) => ({ ...link })),
  };
}
