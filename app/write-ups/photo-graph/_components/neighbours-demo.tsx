"use client";

import { Demo } from "./demo-primitives";
import { useExample } from "./example-context";
import { describeCandidate, format } from "./example-data";
import { exampleViewport } from "./layout-geometry";
import styles from "./walkthrough.module.css";

export default function NeighboursDemo() {
  const {
    data,
    positions,
    query,
    candidate,
    ranking,
    graph,
    config,
    setConfig,
  } = useExample();
  const viewport = exampleViewport(data.nodes, positions);
  const points = new Map(positions.map((point) => [point.id, point]));
  const linkedIds = new Set(
    graph.edges.flatMap((edge) => [edge.source, edge.target]),
  );
  const previewIds = [
    ...new Set([...ranking.slice(0, 4).map((row) => row.id), candidate.id]),
  ];
  const rows = previewIds.map((id) => ({
    photo: data.nodes.find((photo) => photo.id === id)!,
    ...describeCandidate(data, graph, config, id, query.id, ranking),
  }));
  return (
    <Demo name="rules" title="Explore the graph rules">
      <div className={styles.controls}>
        <label>
          Neighbours per photograph <output>{config.neighborsPerNode}</output>
          <input
            aria-label="Neighbours per photograph"
            type="range"
            min="1"
            max="8"
            step="1"
            value={config.neighborsPerNode}
            onChange={(event) =>
              setConfig({
                ...config,
                neighborsPerNode: Number(event.target.value),
              })
            }
          />
        </label>
        <label>
          Colour-difference cutoff <output>{config.maxDistance}</output>
          <input
            aria-label="Colour-difference cutoff"
            type="range"
            min="1"
            max="40"
            step="1"
            value={config.maxDistance}
            onChange={(event) =>
              setConfig({ ...config, maxDistance: Number(event.target.value) })
            }
          />
        </label>
      </div>
      <svg
        className={styles.plot}
        viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
        role="img"
        aria-label={`${data.nodes.length} photographs; ${graph.edges.length} links. Fixed positions show changes to relationships, not a colour-space plot.`}
        data-relationship-map
      >
        {graph.edges.map((edge) => {
          const source = points.get(edge.source)!;
          const target = points.get(edge.target)!;
          const selected = edge.source === query.id || edge.target === query.id;
          return (
            <line
              key={`${edge.source}:${edge.target}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="currentColor"
              strokeWidth={selected ? 2 : 1}
              opacity={
                selected ? 0.25 + edge.weight * 0.75 : 0.04 + edge.weight * 0.16
              }
              vectorEffect="non-scaling-stroke"
              data-edge-source={edge.source}
              data-edge-target={edge.target}
              data-edge-weight={edge.weight}
            />
          );
        })}
        {data.nodes.map((photo) => {
          const point = points.get(photo.id)!;
          const selected = photo.id === query.id || photo.id === candidate.id;
          return (
            <g key={photo.id} data-node-id={photo.id}>
              <title>{photo.label}</title>
              {selected ? (
                <>
                  <rect
                    x={point.x - 26}
                    y={point.y - 20}
                    width="52"
                    height="40"
                    fill="var(--color-canvas)"
                    stroke="currentColor"
                    strokeDasharray={
                      photo.id === candidate.id ? "4 2" : undefined
                    }
                    vectorEffect="non-scaling-stroke"
                  />
                  <image
                    href={photo.src}
                    x={point.x - 24}
                    y={point.y - 18}
                    width="48"
                    height="36"
                    preserveAspectRatio="xMidYMid meet"
                  />
                </>
              ) : (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="3"
                  fill={
                    linkedIds.has(photo.id)
                      ? "currentColor"
                      : "var(--color-canvas)"
                  }
                  stroke="currentColor"
                />
              )}
            </g>
          );
        })}
      </svg>
      <p className={styles.result} role="status">
        <span data-edge-count>{graph.edges.length}</span> links ·{" "}
        <span data-isolate-count>{data.nodes.length - linkedIds.size}</span>{" "}
        isolated photographs
      </p>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption>
            Nearest candidates to {query.label}; selected candidate kept in view
          </caption>
          <thead>
            <tr>
              <th scope="col">Photograph</th>
              <th scope="col">ΔE₀₀</th>
              <th scope="col">Link weight</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-candidate-id={row.id}>
                <th scope="row">
                  {row.rank}. {row.photo.label}
                </th>
                <td>{format(row.distance)}</td>
                <td>
                  {row.linked ? format(row.weight) : "No link"}
                  <span className={styles.rowNote}>
                    {row.forward
                      ? "Nominated"
                      : row.reverse
                        ? "Reverse nomination"
                        : row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Demo>
  );
}
