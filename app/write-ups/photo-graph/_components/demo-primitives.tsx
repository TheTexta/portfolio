"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useExample } from "./example-context";
import { colour, format } from "./example-data";
import type { ExamplePhoto } from "./example-types";
import styles from "./walkthrough.module.css";

export function Demo({
  name,
  title,
  children,
}: {
  name: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <figure className={styles.demo} aria-label={title} data-demo={name}>
      {children}
    </figure>
  );
}

export function PhotoSelect({ role }: { role: "Photograph" | "Candidate" }) {
  const { data, query, candidate, setQueryId, setCandidateId } = useExample();
  return (
    <label className={styles.photoSelect}>
      {role}
      <select
        aria-label={role}
        value={role === "Photograph" ? query.id : candidate.id}
        onChange={(event) =>
          role === "Photograph"
            ? setQueryId(event.target.value)
            : setCandidateId(event.target.value)
        }
      >
        {data.nodes
          .filter((photo) => role === "Photograph" || photo.id !== query.id)
          .map((photo) => (
            <option key={photo.id} value={photo.id}>
              {photo.label}
            </option>
          ))}
      </select>
    </label>
  );
}

export function ColourPhoto({ photo }: { photo: ExamplePhoto }) {
  return (
    <div data-photo-id={photo.id}>
      <div className={styles.photoFrame}>
        <Image
          unoptimized
          src={photo.src}
          width={photo.width}
          height={photo.height}
          alt={photo.alt}
        />
      </div>
      <div
        className={styles.swatch}
        style={{ backgroundColor: colour(photo) }}
        role="img"
        aria-label={`${photo.label} average RGB ${photo.rgb.map((value) => format(value)).join(", ")}`}
      />
      <dl className={styles.descriptor}>
        <div>
          <dt>RGB</dt>
          <dd>{photo.rgb.map((value) => format(value, 1)).join(" · ")}</dd>
        </div>
        <div>
          <dt>LAB</dt>
          <dd>{photo.lab.map((value) => format(value)).join(" · ")}</dd>
        </div>
      </dl>
    </div>
  );
}
