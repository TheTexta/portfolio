"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  buildExampleGraph,
  rankExampleCandidates,
  type ExampleDataset,
} from "./example-data";
import type { ExamplePosition } from "./example-types";

function useExampleState(data: ExampleDataset, positions: ExamplePosition[]) {
  const [pair, setPair] = useState({
    queryId: data.queryId,
    candidateId: data.queryRanking[0].id,
  });
  const [config, setConfig] = useState(data.config);
  const graph = useMemo(
    () =>
      config.neighborsPerNode === data.config.neighborsPerNode &&
      config.maxDistance === data.config.maxDistance
        ? data.defaultGraph
        : buildExampleGraph(data.nodes, config),
    [data, config],
  );
  const query = data.nodes.find((photo) => photo.id === pair.queryId)!;
  const candidate = data.nodes.find((photo) => photo.id === pair.candidateId)!;
  const ranking = useMemo(
    () =>
      pair.queryId === data.queryId
        ? data.queryRanking
        : rankExampleCandidates(data.nodes, pair.queryId),
    [data, pair.queryId],
  );
  return {
    data,
    positions,
    query,
    candidate,
    ranking,
    setQueryId(id: string) {
      setPair((current) => ({
        queryId: id,
        candidateId:
          current.candidateId === id ? current.queryId : current.candidateId,
      }));
    },
    setCandidateId(id: string) {
      setPair((current) => ({ ...current, candidateId: id }));
    },
    config,
    setConfig,
    graph,
  };
}

const ExampleContext = createContext<ReturnType<typeof useExampleState> | null>(
  null,
);

export function ExampleProvider({
  data,
  positions,
  children,
}: {
  data: ExampleDataset;
  positions: ExamplePosition[];
  children?: ReactNode;
}) {
  const value = useExampleState(data, positions);
  return <ExampleContext value={value}>{children}</ExampleContext>;
}

export function useExample() {
  const value = useContext(ExampleContext);
  if (!value)
    throw new Error("Photo Graph demonstrations need ExampleProvider.");
  return value;
}
