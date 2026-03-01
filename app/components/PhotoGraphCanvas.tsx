"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

type RawNode = {
  id?: string | number;
  scale?: number;
  colour?: string;
  correlations?: Record<string, number>;
  url?: string;
};

type SimNode = d3.SimulationNodeDatum & {
  id: string;
  colour?: string;
  url: string;
  w: number;
  h: number;
  fx?: number | null;
  fy?: number | null;
  _grab?: { dx: number; dy: number };
};

type SimLink = d3.SimulationLinkDatum<SimNode> & {
  source: string | SimNode;
  target: string | SimNode;
  value: number;
  _baseValue?: number;
};

type CanvasInputEvent = MouseEvent | TouchEvent | PointerEvent | WheelEvent;

type PhotoGraphCanvasProps = {
  graphUrl?: string;
  imageBasePath?: string;
};

const GRAPH_CONFIG = {
  baseBox: 220,
  minBox: 64,
  maxBox: 300,
  collidePad: 0,
  distMin: 10,
  distMax: 1600,
  charge: -420,
  zoomExtent: [0.25, 4] as [number, number],
  imageConcurrency: 5,
};

const OVERLAY_BG = "rgba(255, 255, 255, 0.274)";
const MODAL_BG = "rgba(255, 255, 255, 0.742)";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function resolveNodeUrl(node: RawNode, id: string, imageBasePath: string) {
  if (node.url) return node.url;
  const normalizedBasePath = imageBasePath.replace(/\/$/, "");
  return `${normalizedBasePath}/${id}.png`;
}

function sizeNodeFromImage(node: SimNode, image: HTMLImageElement) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) return;

  const aspect = width / height;
  if (aspect >= 1) {
    node.w = GRAPH_CONFIG.baseBox;
    node.h = GRAPH_CONFIG.baseBox / aspect;
    return;
  }

  node.h = GRAPH_CONFIG.baseBox;
  node.w = GRAPH_CONFIG.baseBox * aspect;
}

function buildGraph(data: RawNode[], imageBasePath: string) {
  const nodes: SimNode[] = data.map((entry, index) => {
    const id = String(entry.id ?? index + 1);
    const box = clamp(
      Math.round((entry.scale ?? 0.5) * GRAPH_CONFIG.baseBox),
      GRAPH_CONFIG.minBox,
      GRAPH_CONFIG.maxBox
    );

    return {
      id,
      colour: entry.colour,
      url: resolveNodeUrl(entry, id, imageBasePath),
      w: box,
      h: box,
      x: (Math.random() - 0.5) * 50,
      y: (Math.random() - 0.5) * 50,
    };
  });

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const links: SimLink[] = [];

  for (const entry of data) {
    const sourceId = String(entry.id);

    for (const [targetId, rawValue] of Object.entries(entry.correlations ?? {})) {
      if (sourceId === targetId) continue;
      if (!nodeMap.has(sourceId) || !nodeMap.has(targetId)) continue;

      const value = clamp(Number(rawValue) || 0, 0, 1);
      if (!value || sourceId >= targetId) continue;

      links.push({
        source: sourceId,
        target: targetId,
        value,
        _baseValue: value,
      });
    }
  }

  return { nodes, links };
}

function loadImage(url: string, signal: AbortSignal) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Image load aborted", "AbortError"));
      return;
    }

    const image = new Image();
    image.decoding = "async";
    image.crossOrigin = "anonymous";

    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", handleAbort);
    };

    const handleAbort = () => {
      cleanup();
      image.src = "";
      reject(new DOMException("Image load aborted", "AbortError"));
    };

    image.onload = () => {
      cleanup();
      resolve(image);
    };

    image.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load image: ${url}`));
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    image.src = url;
  });
}

export default function PhotoGraphCanvas({
  graphUrl = "/portfolioTable.json",
  imageBasePath = "/assets/images/portfolio",
}: PhotoGraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const transformRef = useRef(d3.zoomIdentity);
  const dprRef = useRef(1);
  const frameRef = useRef<number | null>(null);
  const settleTimeoutRef = useRef<number | null>(null);
  const alphaRef = useRef({ value: 1, updatedAt: 0 });
  const controlsRef = useRef({
    hideConnections: false,
    chargeMult: 1,
    distMinMult: 1,
    distMaxMult: 1,
  });

  const [menuOpen, setMenuOpen] = useState(true);
  const [hideConnections, setHideConnections] = useState(false);
  const [chargeMult, setChargeMult] = useState(1);
  const [distMinMult, setDistMinMult] = useState(1);
  const [distMaxMult, setDistMaxMult] = useState(1);
  const [alpha, setAlpha] = useState(1);
  const [inspectUrl, setInspectUrl] = useState<string | null>(null);
  const [imageProgress, setImageProgress] = useState({ loaded: 0, total: 0 });

  const syncAlpha = () => {
    const simAlpha = simRef.current?.alpha() ?? 0;
    const now = performance.now();
    const { value, updatedAt } = alphaRef.current;

    if (Math.abs(simAlpha - value) < 0.01 && now - updatedAt < 120 && simAlpha >= 0.01) {
      return;
    }

    alphaRef.current = { value: simAlpha, updatedAt: now };
    setAlpha((current) => (Math.abs(current - simAlpha) < 0.01 ? current : simAlpha));
  };

  const paint = () => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.save();
    context.clearRect(0, 0, canvas.width, canvas.height);

    const transform = transformRef.current;
    const dpr = dprRef.current;
    context.setTransform(transform.k * dpr, 0, 0, transform.k * dpr, transform.x * dpr, transform.y * dpr);

    context.strokeStyle = "#000";
    context.lineWidth = 3;

    for (const link of linksRef.current) {
      const opacity = link.value ?? 0;
      if (opacity <= 0) continue;

      const source = link.source as SimNode;
      const target = link.target as SimNode;
      if (!source || !target) continue;

      context.globalAlpha = opacity;
      context.beginPath();
      context.moveTo(source.x ?? 0, source.y ?? 0);
      context.lineTo(target.x ?? 0, target.y ?? 0);
      context.stroke();
    }

    context.globalAlpha = 1;

    for (const node of nodesRef.current) {
      const x = (node.x ?? 0) - node.w / 2;
      const y = (node.y ?? 0) - node.h / 2;
      const image = imagesRef.current.get(node.id);

      if (image) {
        context.drawImage(image, x, y, node.w, node.h);
        continue;
      }

      context.fillStyle = "#ffffff46";
      context.fillRect(x, y, node.w, node.h);
    }

    context.restore();
    syncAlpha();
  };

  const requestRender = () => {
    if (frameRef.current !== null) return;

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      paint();
    });
  };

  const getWorldPoint = (event: CanvasInputEvent, canvas: HTMLCanvasElement) => {
    const point = d3.pointer(event, canvas) as [number, number];
    return transformRef.current.invert(point) as [number, number];
  };

  const hitNode = (event: CanvasInputEvent, canvas: HTMLCanvasElement) => {
    const [mouseX, mouseY] = getWorldPoint(event, canvas);

    for (let index = nodesRef.current.length - 1; index >= 0; index -= 1) {
      const node = nodesRef.current[index];
      const x = (node.x ?? 0) - node.w / 2;
      const y = (node.y ?? 0) - node.h / 2;

      if (mouseX >= x && mouseX <= x + node.w && mouseY >= y && mouseY <= y + node.h) {
        return node;
      }
    }

    return null;
  };

  const applyConnectionVisibility = (hidden: boolean) => {
    for (const link of linksRef.current) {
      const baseValue = link._baseValue ?? link.value ?? 0;
      link._baseValue = baseValue;
      link.value = hidden ? 0 : baseValue;
    }

    requestRender();
  };

  const updateSimulationForces = () => {
    const simulation = simRef.current;
    if (!simulation) return;

    const currentControls = controlsRef.current;
    const minDistance = GRAPH_CONFIG.distMin * currentControls.distMinMult;
    const maxDistance = GRAPH_CONFIG.distMax * currentControls.distMaxMult;

    const linkForce = simulation.force("link") as d3.ForceLink<SimNode, SimLink> | undefined;
    if (linkForce) {
      linkForce.distance((link) => {
        const value = link._baseValue ?? link.value ?? 0;
        return minDistance + (1 - value) * (maxDistance - minDistance);
      });
    }

    const chargeForce = simulation.force("charge") as d3.ForceManyBody<SimNode> | undefined;
    chargeForce?.strength(currentControls.chargeMult * GRAPH_CONFIG.charge);
  };

  const nudgeSimulation = (target = 0.25, settleDelay = 150) => {
    const simulation = simRef.current;
    if (!simulation) return;

    updateSimulationForces();
    simulation.alphaTarget(target).restart();

    if (settleTimeoutRef.current !== null) {
      window.clearTimeout(settleTimeoutRef.current);
    }

    settleTimeoutRef.current = window.setTimeout(() => {
      settleTimeoutRef.current = null;
      simRef.current?.alphaTarget(0);
    }, settleDelay);
  };

  const bindInteractions = (canvas: HTMLCanvasElement) => {
    const selection = d3.select(canvas);

    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent(GRAPH_CONFIG.zoomExtent)
      .filter((event: CanvasInputEvent) => {
        if (event.type === "wheel") return true;
        if ("touches" in event && event.touches.length > 1) return true;
        return !hitNode(event, canvas);
      })
      .on("zoom", (event: d3.D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        transformRef.current = event.transform;
        requestRender();
      });

    zoomRef.current = zoom;
    selection.call(zoom);

    const drag = d3
      .drag<HTMLCanvasElement, SimNode>()
      .container(() => canvas)
      .subject((event: CanvasInputEvent) => hitNode(event, canvas) ?? null)
      .on("start", (event: d3.D3DragEvent<HTMLCanvasElement, SimNode, SimNode>) => {
        const simulation = simRef.current;
        if (!simulation) return;

        canvas.style.cursor = "grabbing";
        if (!event.active) simulation.alphaTarget(0.35).restart();

        const [mouseX, mouseY] = getWorldPoint(event.sourceEvent as CanvasInputEvent, canvas);
        event.subject._grab = {
          dx: (event.subject.x ?? 0) - mouseX,
          dy: (event.subject.y ?? 0) - mouseY,
        };
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      })
      .on("drag", (event: d3.D3DragEvent<HTMLCanvasElement, SimNode, SimNode>) => {
        const [mouseX, mouseY] = getWorldPoint(event.sourceEvent as CanvasInputEvent, canvas);
        const grab = event.subject._grab ?? { dx: 0, dy: 0 };

        event.subject.fx = mouseX + grab.dx;
        event.subject.fy = mouseY + grab.dy;
        requestRender();
      })
      .on("end", (event: d3.D3DragEvent<HTMLCanvasElement, SimNode, SimNode>) => {
        canvas.style.cursor = "default";

        if (!event.active) {
          simRef.current?.alphaTarget(0);
        }

        event.subject.fx = null;
        event.subject.fy = null;
        delete event.subject._grab;
      });

    selection.call(drag);

    const handleClick = (event: MouseEvent) => {
      const node = hitNode(event, canvas);
      if (node) setInspectUrl(node.url);
    };

    const handleMouseMove = (event: MouseEvent) => {
      canvas.style.cursor = hitNode(event, canvas) ? "pointer" : "default";
    };

    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("mousemove", handleMouseMove);

    return () => {
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("mousemove", handleMouseMove);
      selection.on(".zoom", null);
      selection.on(".drag", null);
    };
  };

  const preloadImages = async (signal: AbortSignal) => {
    const nodes = nodesRef.current;
    if (!nodes.length) return;

    let index = 0;

    const worker = async () => {
      while (!signal.aborted) {
        const node = nodes[index];
        index += 1;
        if (!node) return;

        try {
          const image = await loadImage(node.url, signal);
          if (signal.aborted) return;

          sizeNodeFromImage(node, image);
          imagesRef.current.set(node.id, image);

          const collideForce = simRef.current?.force("collide") as d3.ForceCollide<SimNode> | undefined;
          collideForce?.initialize?.(nodesRef.current);

          nudgeSimulation(0.08, 220);
          requestRender();
        } catch (error) {
          if (!isAbortError(error)) {
            console.error(error);
          }
        } finally {
          if (!signal.aborted) {
            setImageProgress((current) => ({
              loaded: current.loaded + 1,
              total: current.total,
            }));
          }
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(GRAPH_CONFIG.imageConcurrency, nodes.length) }, () => worker())
    );
  };

  useEffect(() => {
    let disposed = false;
    const abortController = new AbortController();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      dprRef.current = window.devicePixelRatio || 1;

      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = Math.round(width * dprRef.current);
      canvas.height = Math.round(height * dprRef.current);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      requestRender();
    };

    const cleanupInteractions = bindInteractions(canvas);
    resize();
    window.addEventListener("resize", resize);

    const init = async () => {
      try {
        const response = await fetch(graphUrl, {
          cache: "no-store",
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch graph data: ${graphUrl}`);
        }

        const data = (await response.json()) as RawNode[];
        if (disposed) return;

        const { nodes, links } = buildGraph(data, imageBasePath);
        nodesRef.current = nodes;
        linksRef.current = links;
        imagesRef.current = new Map();
        setImageProgress({ loaded: 0, total: nodes.length });

        const simulation = d3
          .forceSimulation<SimNode>(nodes)
          .force(
            "link",
            d3
              .forceLink<SimNode, SimLink>(links)
              .id((node) => node.id)
              .distance((link) => {
                const value = link._baseValue ?? link.value ?? 0;
                return GRAPH_CONFIG.distMin + (1 - value) * (GRAPH_CONFIG.distMax - GRAPH_CONFIG.distMin);
              })
              .strength((link) => 0.15 + 0.85 * (link._baseValue ?? link.value ?? 0))
          )
          .force("charge", d3.forceManyBody<SimNode>().strength(GRAPH_CONFIG.charge))
          .force("x", d3.forceX<SimNode>().strength(0.03))
          .force("y", d3.forceY<SimNode>().strength(0.09))
          .force(
            "collide",
            d3
              .forceCollide<SimNode>()
              .radius((node) => Math.max(node.w, node.h) / 2 + GRAPH_CONFIG.collidePad)
              .iterations(3)
          )
          .on("tick", requestRender);

        simRef.current = simulation;
        applyConnectionVisibility(controlsRef.current.hideConnections);
        updateSimulationForces();
        simulation.alpha(1).restart();
        requestRender();

        await preloadImages(abortController.signal);
      } catch (error) {
        if (!isAbortError(error)) {
          console.error(error);
        }
      }
    };

    init();

    return () => {
      disposed = true;
      abortController.abort();

      window.removeEventListener("resize", resize);
      cleanupInteractions();

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      if (settleTimeoutRef.current !== null) {
        window.clearTimeout(settleTimeoutRef.current);
        settleTimeoutRef.current = null;
      }

      simRef.current?.stop();
      simRef.current = null;
    };
    // These helpers read mutable refs on purpose; reinitializing the graph on every render is unnecessary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphUrl, imageBasePath]);

  useEffect(() => {
    controlsRef.current.hideConnections = hideConnections;
    applyConnectionVisibility(hideConnections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideConnections]);

  useEffect(() => {
    controlsRef.current.chargeMult = chargeMult;
    controlsRef.current.distMinMult = distMinMult;
    controlsRef.current.distMaxMult = distMaxMult;
    nudgeSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeMult, distMinMult, distMaxMult]);

  const progressVisible = imageProgress.total > 0 && imageProgress.loaded < imageProgress.total;
  const progressPct = imageProgress.total
    ? Math.round((imageProgress.loaded / imageProgress.total) * 100)
    : 0;
  const alphaColor = alpha < 0.01 ? "green" : "red";

  return (
    <div style={{ margin: 0, overflow: "hidden" }}>
      <Link
        href="/"
        style={{
          position: "absolute",
          right: "min(1vw, 1vh)",
          top: "min(1vw, 1vh)",
          paddingLeft: "0.3rem",
          paddingRight: "0.3rem",
          fontSize: "1rem",
          textAlign: "center",
          backgroundColor: OVERLAY_BG,
          border: "none",
          cursor: "pointer",
          zIndex: 5,
        }}
      >
        ==&gt;
      </Link>

      {!menuOpen && (
        <button
          onClick={() => setMenuOpen(true)}
          style={{
            position: "absolute",
            left: "min(1vw, 1vh)",
            top: "min(1vw, 1vh)",
            paddingLeft: "0.3rem",
            paddingRight: "0.3rem",
            fontSize: "1rem",
            backgroundColor: OVERLAY_BG,
            border: "none",
            cursor: "pointer",
            zIndex: 5,
          }}
        >
          ☰
        </button>
      )}

      {menuOpen && (
        <div
          style={{
            position: "absolute",
            top: "min(1vw, 1vh)",
            left: "min(1vw, 1vh)",
            backgroundColor: OVERLAY_BG,
            textAlign: "center",
            zIndex: 5,
            padding: 6,
          }}
        >
          <button
            onClick={() => setMenuOpen(false)}
            style={{
              position: "absolute",
              right: "2%",
              top: "2%",
              paddingLeft: "0.3rem",
              paddingRight: "0.3rem",
              fontSize: "1rem",
              backgroundColor: OVERLAY_BG,
              border: "none",
              cursor: "pointer",
            }}
          >
            X
          </button>

          <p style={{ margin: 0, padding: 0, fontSize: "0.8rem" }}>Simulation Alpha:</p>
          <p style={{ margin: 0, padding: 0, fontSize: "0.8rem", color: alphaColor }}>{alpha.toFixed(3)}</p>

          <p style={{ margin: 0, padding: 0, fontSize: "0.8rem" }}>
            Hide Connections{" "}
            <input
              type="checkbox"
              checked={hideConnections}
              onChange={(event) => setHideConnections(event.target.checked)}
              style={{ height: 10, margin: 0 }}
            />
          </p>

          <input
            type="range"
            min={0}
            max={5}
            step="any"
            value={chargeMult}
            onChange={(event) => setChargeMult(Number(event.target.value))}
            style={{ userSelect: "none", height: 3, margin: 10 }}
          />
          <p style={{ margin: 0, padding: 0, fontSize: "0.8rem" }}>Charge Mult: {chargeMult.toFixed(2)}</p>

          <input
            type="range"
            min={0}
            max={500}
            step="any"
            value={distMinMult / 0.1}
            onChange={(event) => setDistMinMult(Number(event.target.value) * 0.1)}
            style={{ userSelect: "none", height: 3, margin: 10 }}
          />
          <p style={{ margin: 0, padding: 0, fontSize: "0.8rem" }}>Dist Min Mult: {distMinMult.toFixed(2)}</p>

          <input
            type="range"
            min={0}
            max={50}
            step="any"
            value={distMaxMult / 0.1}
            onChange={(event) => setDistMaxMult(Number(event.target.value) * 0.1)}
            style={{ userSelect: "none", height: 3, margin: 10 }}
          />
          <p style={{ margin: 0, padding: 0, fontSize: "0.8rem" }}>Dist Max Mult: {distMaxMult.toFixed(2)}</p>
        </div>
      )}

      {inspectUrl && (
        <div
          onClick={() => setInspectUrl(null)}
          style={{
            position: "absolute",
            width: "70vw",
            height: "70vh",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 10,
            backgroundColor: MODAL_BG,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <button
            onClick={(event) => {
              event.stopPropagation();
              setInspectUrl(null);
            }}
            style={{
              position: "absolute",
              right: "2%",
              top: "2%",
              paddingLeft: "0.3rem",
              paddingRight: "0.3rem",
              fontSize: "1rem",
              backgroundColor: OVERLAY_BG,
              border: "none",
              cursor: "pointer",
            }}
          >
            X
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={inspectUrl}
            alt=""
            style={{ maxWidth: "90%", maxHeight: "90%" }}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}

      {progressVisible && (
        <div
          style={{
            position: "absolute",
            bottom: "1vh",
            left: "1vw",
            width: "max(20vw, 33vh)",
            height: "1vh",
            backgroundColor: "rgba(255,255,255,0)",
            zIndex: 6,
          }}
        >
          <div
            style={{
              backgroundColor: "black",
              width: `${progressPct}%`,
              height: "20%",
              position: "relative",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: "0.65rem",
              color: "white",
              pointerEvents: "none",
            }}
          >
            {progressPct}%
          </span>
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{
          height: "100%",
          width: "100%",
          margin: 0,
          imageRendering: "pixelated",
          display: "block",
        }}
      />
    </div>
  );
}
