"use client";

import dynamic from "next/dynamic";
import { useRef, useEffect, useState } from "react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-white" />, // optional placeholder
});

const Graph = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-dvh w-full bg-white">
      <ForceGraph2D
        graphData={{ nodes: [{id: "node1"}, {id: "node2"}], links: [{source: "node1", target: "node2"}] }}
        width={dimensions.width}
        height={dimensions.height}
      ></ForceGraph2D>
    </div>
  );
};

export default Graph;
