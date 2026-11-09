import type { GraphControls, PhotoGraphData, PhotoGraphNode } from "./types";

export type NodePosition = {
  x: number;
  y: number;
  z?: number;
};

export type PhotoGraphViewSnapshot = {
  data: PhotoGraphData;
  positions: Map<string, NodePosition>;
  camera: NodePosition;
  target?: NodePosition;
  zoom?: number;
  forceSettings?: string;
};

export function photoGraphForceSettingsKey(controls: GraphControls) {
  return [
    controls.collidePad,
    controls.collideBoxScale,
    controls.collideStrength,
    controls.collideIterations,
    controls.distMinMult,
    controls.distMaxMult,
    controls.chargeMult,
  ].join(":");
}

export function snapshotPositions(nodes: PhotoGraphNode[]) {
  return new Map(
    nodes
      .filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y))
      .map((node) => [
        node.id,
        {
          x: node.x!,
          y: node.y!,
          ...(Number.isFinite(node.z) ? { z: node.z as number } : {}),
        },
      ]),
  );
}

// Each force-graph mutates nodes AND link endpoints. Never hand it the fetched
// graph or another renderer's objects (including Three's private __* fields).
export function createRendererData(
  data: PhotoGraphData,
  snapshot?: PhotoGraphViewSnapshot | null,
): PhotoGraphData {
  const positions = snapshot?.data === data ? snapshot.positions : undefined;
  return {
    nodes: data.nodes.map((node) => ({ ...node, ...positions?.get(node.id) })),
    links: data.links.map((link) => ({
      ...link,
      source: typeof link.source === "string" ? link.source : link.source.id,
      target: typeof link.target === "string" ? link.target : link.target.id,
    })),
  };
}

export function seedPhotoGraphDepth(id: string) {
  // Stable across toggles and independent of the database or feature models.
  let hash = 2166136261;
  for (const character of id) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return ((hash / 0xffffffff) * 2 - 1) * 500 || 1;
}

export function createThreeDRendererData(
  data: PhotoGraphData,
  snapshot?: PhotoGraphViewSnapshot | null,
) {
  const cloned = createRendererData(data, snapshot);
  for (const node of cloned.nodes) {
    // d3-force-3d replaces ALL coordinates if any axis is uninitialized.
    node.x ??= seedPhotoGraphDepth(`${node.id}:x`);
    node.y ??= seedPhotoGraphDepth(`${node.id}:y`);
    node.z ??= seedPhotoGraphDepth(node.id);
  }
  return cloned;
}

// Fit from numeric positions, not Three object bounds: onEngineTick runs before
// the library copies simulation positions onto its scene objects.
export function fitPhotoGraph3DView(
  nodes: PhotoGraphNode[],
  aspect: number,
  fov: number,
) {
  const positioned = nodes.filter((node) =>
    [node.x, node.y, node.z].every(Number.isFinite),
  );
  if (!positioned.length) return null;
  const minX = Math.min(...positioned.map((node) => node.x! - node.w / 2));
  const maxX = Math.max(...positioned.map((node) => node.x! + node.w / 2));
  const minY = Math.min(...positioned.map((node) => node.y! - node.h / 2));
  const maxY = Math.max(...positioned.map((node) => node.y! + node.h / 2));
  const minZ = Math.min(...positioned.map((node) => node.z as number));
  const maxZ = Math.max(...positioned.map((node) => node.z as number));
  const target = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    z: (minZ + maxZ) / 2,
  };
  const tangent = Math.tan((fov * Math.PI) / 360);
  const distance =
    Math.max(
      (maxX - minX) / (2 * tangent * aspect),
      (maxY - minY) / (2 * tangent),
    ) +
    (maxZ - minZ) / 2;
  return {
    target,
    camera: { ...target, z: target.z + Math.max(1, distance) * 1.15 },
  };
}
