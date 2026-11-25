"use client";

import { useEffect, useState } from "react";
import PhotoGraphCanvas from "@/app/components/projects/photo-graph/PhotoGraphCanvas";

export default function PhotoGraphKeyboardFixture() {
  const [graphUrl, setGraphUrl] = useState(
    "/api/photo-graph/graph?fixture=initial",
  );
  useEffect(() => {
    const replace = () =>
      setGraphUrl("/api/photo-graph/graph?fixture=replacement");
    window.addEventListener("photo-graph-fixture-replace", replace);
    return () =>
      window.removeEventListener("photo-graph-fixture-replace", replace);
  }, []);
  return (
    <main>
      <button
        type="button"
        onClick={() =>
          window.dispatchEvent(new Event("photo-graph-fixture-replace"))
        }
      >
        Replace graph
      </button>
      <section aria-label="First embedded graph" className="relative h-96">
        <PhotoGraphCanvas
          graphUrl={graphUrl}
          showNavigation={false}
          fitToCanvas
        />
      </section>
      <section aria-label="Second embedded graph" className="relative h-96">
        <PhotoGraphCanvas showNavigation={false} fitToCanvas />
      </section>
      <section aria-label="Opt-out graph" className="relative h-96">
        <PhotoGraphCanvas
          showControls={false}
          showNavigation={false}
          fitToCanvas
        />
      </section>
    </main>
  );
}
