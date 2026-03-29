"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
} from "react";
import * as d3 from "d3";

import {
  computePhotoGraphLinkDistance,
  computePhotoGraphLinkStrength,
} from "@/lib/photo-graph/force-graph";

import { GRAPH_CONFIG } from "./config";
import type {
  GraphControls,
  PhotoGraphInstance,
  PhotoGraphLink,
  PhotoGraphNode,
  RectangleCollisionForce,
  RuntimeForce,
} from "./types";

function createRectangleCollideForce(
  padding: number = 0,
  boxScale: number = GRAPH_CONFIG.collideBoxScale,
  strength: number = GRAPH_CONFIG.collideStrength,
  iterations: number = GRAPH_CONFIG.collideIterations,
): RectangleCollisionForce {
  let nodes: PhotoGraphNode[] = [];

  const force: RectangleCollisionForce = (alpha) => {
    if (!nodes.length) {
      return;
    }

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
        const left = nodes[leftIndex];
        const leftX = left.x ?? 0;
        const leftY = left.y ?? 0;
        const leftHalfWidth = (left.w * boxScale) / 2 + padding;
        const leftHalfHeight = (left.h * boxScale) / 2 + padding;

        for (
          let rightIndex = leftIndex + 1;
          rightIndex < nodes.length;
          rightIndex += 1
        ) {
          const right = nodes[rightIndex];
          const rightX = right.x ?? 0;
          const rightY = right.y ?? 0;
          const rightHalfWidth = (right.w * boxScale) / 2 + padding;
          const rightHalfHeight = (right.h * boxScale) / 2 + padding;

          const deltaX = rightX - leftX;
          const deltaY = rightY - leftY;
          const overlapX = leftHalfWidth + rightHalfWidth - Math.abs(deltaX);
          if (overlapX <= 0) {
            continue;
          }

          const overlapY = leftHalfHeight + rightHalfHeight - Math.abs(deltaY);
          if (overlapY <= 0) {
            continue;
          }

          const pushFactor = strength * alpha;
          if (overlapX < overlapY) {
            const directionX = deltaX === 0 ? 1 : Math.sign(deltaX);
            const pushX = overlapX * pushFactor * directionX;

            if (left.fx == null && right.fx == null) {
              left.vx = (left.vx ?? 0) - pushX * 0.5;
              right.vx = (right.vx ?? 0) + pushX * 0.5;
            } else if (left.fx == null) {
              left.vx = (left.vx ?? 0) - pushX;
            } else if (right.fx == null) {
              right.vx = (right.vx ?? 0) + pushX;
            }
            continue;
          }

          const directionY = deltaY === 0 ? 1 : Math.sign(deltaY);
          const pushY = overlapY * pushFactor * directionY;

          if (left.fy == null && right.fy == null) {
            left.vy = (left.vy ?? 0) - pushY * 0.5;
            right.vy = (right.vy ?? 0) + pushY * 0.5;
          } else if (left.fy == null) {
            left.vy = (left.vy ?? 0) - pushY;
          } else if (right.fy == null) {
            right.vy = (right.vy ?? 0) + pushY;
          }
        }
      }
    }
  };

  force.initialize = (nextNodes) => {
    nodes = Array.from(nextNodes);
  };

  return force;
}

type UsePhotoGraphForcesArgs = {
  fgRef: RefObject<PhotoGraphInstance | undefined>;
  nodes: PhotoGraphNode[];
  controls: GraphControls;
};

export function usePhotoGraphForces({
  fgRef,
  nodes,
  controls,
}: UsePhotoGraphForcesArgs) {
  const reinitializeCollisionForce = useCallback(
    (nextNodes = nodes) => {
      const collideForce = fgRef.current?.d3Force("collide") as
        | RectangleCollisionForce
        | undefined;
      collideForce?.initialize?.(nextNodes);
    },
    [fgRef, nodes],
  );

  const configureRuntimeForces = useCallback(() => {
    const graph = fgRef.current;
    if (!graph) {
      return;
    }

    graph.d3Force(
      "collide",
      createRectangleCollideForce(
        controls.collidePad,
        controls.collideBoxScale,
        controls.collideStrength,
        controls.collideIterations,
      ) as unknown as RuntimeForce,
    );

    const linkForce = graph.d3Force("link") as
      | d3.ForceLink<PhotoGraphNode, PhotoGraphLink>
      | undefined;
    if (linkForce) {
      const minDistance = GRAPH_CONFIG.distMin * controls.distMinMult;
      const maxDistance = GRAPH_CONFIG.distMax * controls.distMaxMult;

      linkForce.distance((link) =>
        computePhotoGraphLinkDistance(
          link as PhotoGraphLink,
          minDistance,
          maxDistance,
        ),
      );
      linkForce.strength((link) =>
        computePhotoGraphLinkStrength(link as PhotoGraphLink),
      );
    }

    const chargeForce = graph.d3Force("charge") as
      | d3.ForceManyBody<PhotoGraphNode>
      | undefined;
    chargeForce?.strength(controls.chargeMult * GRAPH_CONFIG.charge);
  }, [
    controls.chargeMult,
    controls.collideBoxScale,
    controls.collideIterations,
    controls.collidePad,
    controls.collideStrength,
    controls.distMaxMult,
    controls.distMinMult,
    fgRef,
  ]);

  useEffect(() => {
    if (!nodes.length) {
      return;
    }

    configureRuntimeForces();
    reinitializeCollisionForce(nodes);
    fgRef.current?.d3ReheatSimulation();
  }, [configureRuntimeForces, fgRef, nodes, reinitializeCollisionForce]);

  return {
    reinitializeCollisionForce,
  };
}
