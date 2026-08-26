"use client";

import { useCallback, useEffect, useState } from "react";

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
  loadStatus: PhotoGraphLoadStatus;
};

type PhotoGraphLoadStatus = "loading" | "ready" | "empty" | "error";

const EMPTY_GRAPH_DATA_RESULT: PhotoGraphDataResult = {
  graphData: {
    nodes: [],
    links: [],
  },
  loadStatus: "loading",
};

const DEFAULT_GRAPH_URL = "/api/photo-graph/graph";

export function usePhotoGraphData(graphUrl = DEFAULT_GRAPH_URL) {
  const [graphResult, setGraphResult] = useState<PhotoGraphDataResult>(
    EMPTY_GRAPH_DATA_RESULT,
  );
  const [loadAttempt, setLoadAttempt] = useState(0);

  const retry = useCallback(() => {
    setGraphResult((current) => ({
      ...current,
      loadedGraphUrl: graphUrl,
      loadStatus: "loading",
    }));
    setLoadAttempt((current) => current + 1);
  }, [graphUrl]);

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
        loadStatus: payload.nodes.length > 0 ? "ready" : "empty",
      });
    };

    void loadGraph().catch((error: unknown) => {
      if (!disposed && !isAbortError(error)) {
        console.error(error);
        setGraphResult({
          ...EMPTY_GRAPH_DATA_RESULT,
          loadedGraphUrl: graphUrl,
          loadStatus: "error",
        });
      }
    });

    return () => {
      disposed = true;
      abortController.abort();
    };
  }, [graphUrl, loadAttempt]);

  return {
    defaultGraphControls:
      graphResult.loadedGraphUrl === graphUrl
        ? graphResult.defaultGraphControls
        : undefined,
    graphData: graphResult.graphData,
    loadStatus:
      graphResult.loadedGraphUrl === graphUrl
        ? graphResult.loadStatus
        : "loading",
    retry,
  };
}
