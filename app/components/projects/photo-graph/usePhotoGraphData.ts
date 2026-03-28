"use client";

import { useEffect, useState } from "react";

import type { PhotoGraphPayload } from "@/lib/photo-graph/types";

import type { PhotoGraphData } from "./types";
import { toPhotoGraphData } from "./types";
import { isAbortError } from "./utils";

const EMPTY_GRAPH_DATA: PhotoGraphData = {
  nodes: [],
  links: [],
};

export function usePhotoGraphData() {
  const [graphData, setGraphData] = useState<PhotoGraphData>(EMPTY_GRAPH_DATA);

  useEffect(() => {
    let disposed = false;
    const abortController = new AbortController();

    const loadGraph = async () => {
      const response = await fetch("/api/photo-graph/graph", {
        cache: "no-store",
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch photo graph data.");
      }

      const payload = (await response.json()) as PhotoGraphPayload;
      if (disposed || abortController.signal.aborted) {
        return;
      }

      setGraphData(toPhotoGraphData(payload));
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
  }, []);

  return graphData;
}
