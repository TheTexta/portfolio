import * as d3 from "d3";
import {
  computePhotoGraphLinkDistance,
  computePhotoGraphLinkStrength,
} from "@/lib/photo-graph/force-graph";
import { createRectangleCollideForce } from "@/lib/photo-graph/rectangle-collision";
import type {
  ExampleEdge,
  ExamplePhoto,
  ExamplePosition,
} from "./example-types";
import { exampleNodeBox, MINIATURE_SCALE } from "./layout-geometry";

type LayoutNode = d3.SimulationNodeDatum & { id: string; w: number; h: number };
type LayoutLink = d3.SimulationLinkDatum<LayoutNode> & { value: number };
const SETTLE_TICKS = 600;

export function exampleLinkDistance(link: LayoutLink, spacing = 1) {
  return computePhotoGraphLinkDistance(
    link,
    10 * MINIATURE_SCALE * spacing,
    1600 * MINIATURE_SCALE * spacing,
  );
}

function createSimulation(
  photos: ExamplePhoto[],
  edges: ExampleEdge[],
  positions: ExamplePosition[],
  spacing: number,
) {
  const byId = new Map(positions.map((position) => [position.id, position]));
  const nodes: LayoutNode[] = photos.map((photo) => ({
    id: photo.id,
    w: exampleNodeBox(photo).w,
    h: exampleNodeBox(photo).h,
    ...(byId.has(photo.id)
      ? { x: byId.get(photo.id)!.x, y: byId.get(photo.id)!.y }
      : {}),
  }));
  const links: LayoutLink[] = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    value: edge.weight,
  }));
  let seed = 0x1122765;
  const simulation = d3
    .forceSimulation<LayoutNode, LayoutLink>(nodes)
    .stop()
    .randomSource(
      () => (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296,
    )
    .alphaDecay(1 - Math.pow(0.001, 1 / SETTLE_TICKS))
    .force(
      "link",
      d3
        .forceLink<LayoutNode, LayoutLink>(links)
        .id((node) => node.id)
        .distance((link) => exampleLinkDistance(link, spacing))
        .strength(computePhotoGraphLinkStrength),
    )
    .force(
      "charge",
      d3.forceManyBody<LayoutNode>().strength(-420 * MINIATURE_SCALE ** 2),
    )
    .force("x", d3.forceX<LayoutNode>().strength(0.008))
    .force("y", d3.forceY<LayoutNode>().strength(0.008))
    .force("collide", createRectangleCollideForce<LayoutNode>());
  return { nodes, simulation };
}

function snapshot(nodes: LayoutNode[]): ExamplePosition[] {
  return nodes.map(({ id, x = 0, y = 0 }) => ({ id, x, y }));
}

/** Offline/server entry point. Stops D3 immediately, then advances a fixed tick count. */
export function settleExampleLayout(
  nodes: ExamplePhoto[],
  edges: ExampleEdge[],
): ExamplePosition[] {
  const runtime = createSimulation(nodes, edges, [], 1);
  runtime.simulation.tick(SETTLE_TICKS);
  return snapshot(runtime.nodes);
}

/** Called only following an explicit Run; owns all mutable D3 nodes and links. */
export function runExampleLayout(
  nodes: ExamplePhoto[],
  edges: ExampleEdge[],
  positions: ExamplePosition[],
  spacing: number,
  onTick: (positions: ExamplePosition[]) => void,
  onEnd: () => void,
) {
  const runtime = createSimulation(nodes, edges, positions, spacing);
  runtime.simulation
    .on("tick", () => onTick(snapshot(runtime.nodes)))
    .on("end", onEnd)
    .restart();
  return {
    stop: () => {
      runtime.simulation.stop();
    },
  };
}
