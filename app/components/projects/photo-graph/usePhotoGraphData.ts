"use client";

import { useEffect, useState } from "react";

import { normalizePhotoGraphRuntimeControls } from "@/lib/photo-graph/graph-controls";
import type {
  PhotoGraphPayloadResponse,
  PhotoGraphRuntimeControls,
} from "@/lib/photo-graph/types";

import type { PhotoGraphData } from "./types";
import { toPhotoGraphData } from "./types";
import { isAbortError } from "./utils";

type PhotoGraphDataResult = {
  defaultGraphControls?: PhotoGraphRuntimeControls;
  graphData: PhotoGraphData;
  loadedGraphUrl?: string;
};

const EMPTY_GRAPH_DATA_RESULT: PhotoGraphDataResult = {
  graphData: {
    nodes: [],
    links: [],
  },
};

const DEFAULT_GRAPH_URL = "/api/photo-graph/graph";

export function usePhotoGraphData(graphUrl = DEFAULT_GRAPH_URL) {
  const [graphResult, setGraphResult] = useState<PhotoGraphDataResult>(
    EMPTY_GRAPH_DATA_RESULT,
  );

  useEffect(() => {
    let disposed = false;
    const abortController = new AbortController();

    const loadGraph = async () => {
      const response = await fetch(graphUrl, {
        cache: "no-store",
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch photo graph data.");
      }

      const payload = (await response.json()) as PhotoGraphPayloadResponse;
      if (disposed || abortController.signal.aborted) {
        return;
      }

      setGraphResult({
        defaultGraphControls:
          "defaultGraphControls" in payload
            ? normalizePhotoGraphRuntimeControls(payload.defaultGraphControls)
            : undefined,
        graphData: toPhotoGraphData(payload),
        loadedGraphUrl: graphUrl,
      });
    };

    void loadGraph().catch((error: unknown) => {
      if (!isAbortError(error)) {
        console.error(error);
      }
    });

    return () => {
      disposed = true;
      abortController.abort();
    };
  }, [graphUrl]);

  return {
    defaultGraphControls:
      graphResult.loadedGraphUrl === graphUrl
        ? graphResult.defaultGraphControls
        : undefined,
    graphData: graphResult.graphData,
  };
}
