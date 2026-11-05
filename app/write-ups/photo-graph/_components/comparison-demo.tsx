"use client";

import {
  computePhotoGraphModelDistance,
  traceDeltaE2000,
} from "@/lib/photo-graph/similarity-models";
import { ColourPhoto, Demo, PhotoSelect } from "./demo-primitives";
import { useExample } from "./example-context";
import { format, signed } from "./example-data";
import styles from "./walkthrough.module.css";

export default function ComparisonDemo() {
  const { query, candidate } = useExample();
  const trace = traceDeltaE2000(query.lab, candidate.lab);
  const geometric = computePhotoGraphModelDistance(
    query,
    candidate,
    "mean-lab-cie76",
  );
  return (
    <Demo name="comparison" title="Inspect a colour comparison">
      <div className={styles.pair}>
        <div>
          <PhotoSelect role="Photograph" />
          <ColourPhoto photo={query} />
        </div>
        <div>
          <PhotoSelect role="Candidate" />
          <ColourPhoto photo={candidate} />
        </div>
      </div>
      <p className={styles.result}>
        CIEDE2000 difference{" "}
        <strong data-distance="ciede2000">{format(trace.distance)}</strong>
      </p>
      <details className={styles.disclosure}>
        <summary>Inspect the arithmetic</summary>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <caption>
              CIEDE2000: adjusted differences divided by perceptual scales
            </caption>
            <thead>
              <tr>
                <th scope="col">Term</th>
                <th scope="col">Difference</th>
                <th scope="col">Scale</th>
                <th scope="col">Normalised</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "Lightness",
                  trace.deltaL,
                  trace.lightnessScale,
                  trace.normalizedL,
                ],
                [
                  "Chroma",
                  trace.deltaChroma,
                  trace.chromaScale,
                  trace.normalizedChroma,
                ],
                ["Hue", trace.deltaHue, trace.hueScale, trace.normalizedHue],
              ].map(([label, difference, scale, normalized]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{signed(Number(difference))}</td>
                  <td>{format(Number(scale))}</td>
                  <td>{signed(Number(normalized))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.equation}>
          ΔE₀₀ = √({format(trace.lightnessSquared)} +{" "}
          {format(trace.chromaSquared)} + {format(trace.hueSquared)} + (
          {signed(trace.interaction)})) ≈ {format(trace.distance)}
        </p>
        <p className={styles.note}>
          The interaction is signed; values are rounded only for display.
        </p>
        <p className={styles.equation}>
          Euclidean reference: ΔE₇₆ = √(ΔL*² + Δa*² + Δb*²) ≈{" "}
          <span data-distance="cie76">{format(geometric)}</span>
        </p>
        <a href="https://github.com/TheTexta/portfolio/blob/main/lib/photo-graph/similarity-models.ts">
          Shared comparison code
        </a>
      </details>
    </Demo>
  );
}
