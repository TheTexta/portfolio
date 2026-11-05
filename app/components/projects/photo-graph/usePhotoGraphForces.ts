"use client";

import { type RefObject, useCallback } from "react";
import * as d3 from "d3";
import { createRectangleCollideForce } from "@/lib/photo-graph/rectangle-collision";

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
        RectangleCollisionForce | undefined;
      collideForce?.initialize?.(nextNodes);
    },
    [fgRef, nodes],
  );

  const configureRuntimeForces = useCallback(
    (instance?: PhotoGraphInstance) => {
      const graph = instance ?? fgRef.current;
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
        d3.ForceLink<PhotoGraphNode, PhotoGraphLink> | undefined;
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
        d3.ForceManyBody<PhotoGraphNode> | undefined;
      chargeForce?.strength(controls.chargeMult * GRAPH_CONFIG.charge);
    },
    [
      controls.chargeMult,
      controls.collideBoxScale,
      controls.collideIterations,
      controls.collidePad,
      controls.collideStrength,
      controls.distMaxMult,
      controls.distMinMult,
      fgRef,
    ],
  );

  return {
    configureRuntimeForces,
    reinitializeCollisionForce,
  };
}
