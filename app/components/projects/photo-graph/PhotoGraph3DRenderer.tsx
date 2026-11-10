"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ForceGraph3D, { type ForceGraphMethods } from "react-force-graph-3d";
import { PerspectiveCamera, Sprite, SpriteMaterial, Vector2 } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { animate } from "framer-motion";

import {
  computePhotoGraphLinkDistance,
  computePhotoGraphLinkStrength,
  getPhotoGraphLinkValue,
} from "@/lib/photo-graph/force-graph";
import { createSphereCollideForce } from "@/lib/photo-graph/sphere-collision";
import { GRAPH_CONFIG, PHOTO_GRAPH_ALPHA_DECAY } from "./config";
import type {
  PhotoGraphData,
  PhotoGraphLink,
  PhotoGraphNode,
  PhotoGraphRendererProps,
} from "./types";
import {
  createThreeDRendererData,
  snapshotPositions,
  type PhotoGraphViewSnapshot,
  photoGraphForceSettingsKey,
  fitPhotoGraph3DView,
} from "./view-state";
import { usePhotoGraphTextures } from "./usePhotoGraphTextures";
import { photoGraphRenderPixelRatio } from "./render-quality";
import { attachPhotoGraphPanModifier } from "./drag-pan-modifier";

const EMPTY_GRAPH: PhotoGraphData = { nodes: [], links: [] };
const RENDERER_CONFIG = { antialias: true, alpha: false };

export type PhotoGraph3DRendererProps = PhotoGraphRendererProps & {
  snapshot: PhotoGraphViewSnapshot | null;
  onSaveSnapshot: (snapshot: PhotoGraphViewSnapshot) => void;
  onFailure: () => void;
};

export default function PhotoGraph3DRenderer({
  graphData: sourceData,
  dimensions,
  controls,
  activeDarkMode,
  reducedMotion,
  onInspect,
  snapshot,
  onSaveSnapshot,
  resetViewKey,
  onFailure,
}: PhotoGraph3DRendererProps) {
  const graphRef = useRef<
    ForceGraphMethods<PhotoGraphNode, PhotoGraphLink> | undefined
  >(undefined);
  const restoredSnapshot = useMemo(
    () => (snapshot?.data === sourceData ? snapshot : null),
    [snapshot, sourceData],
  );
  const data = useMemo(
    () => createThreeDRendererData(sourceData, restoredSnapshot),
    [sourceData, restoredSnapshot],
  );
  const spritesRef = useRef(new Map<string, Sprite>());
  const [ready, setReady] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const configuredRef = useRef<string | null>(null);
  const initializedCameraRef = useRef(false);
  const resetRef = useRef(resetViewKey);
  const resetAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
  const forceSettings = photoGraphForceSettingsKey(controls);
  const retainLayout = restoredSnapshot?.forceSettings === forceSettings;

  const nodeObject = useCallback((node: PhotoGraphNode) => {
    let sprite = spritesRef.current.get(node.id);
    if (!sprite) {
      sprite = new Sprite(
        new SpriteMaterial({
          color: 0x888888,
          alphaTest: 0.01,
          toneMapped: false,
        }),
      );
      sprite.scale.set(node.w, node.h, 1);
      spritesRef.current.set(node.id, sprite);
    }
    return sprite;
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const collision = createSphereCollideForce(
      controls.collidePad,
      controls.collideBoxScale,
      controls.collideStrength,
      controls.collideIterations,
    );
    graph.d3Force("collide", collision);
    const link = graph.d3Force("link");
    link?.distance((edge: PhotoGraphLink) =>
      computePhotoGraphLinkDistance(
        edge,
        GRAPH_CONFIG.distMin * controls.distMinMult,
        GRAPH_CONFIG.distMax * controls.distMaxMult,
      ),
    );
    link?.strength(computePhotoGraphLinkStrength);
    graph
      .d3Force("charge")
      ?.strength(GRAPH_CONFIG.charge * controls.chargeMult);
    const changed =
      configuredRef.current !== null && configuredRef.current !== forceSettings;
    configuredRef.current = forceSettings;
    if (changed) {
      graph.d3ReheatSimulation();
    }
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) {
        setReady(true);
        if (changed) setInteracted(true);
      }
    });
    return () => {
      disposed = true;
    };
  }, [
    controls.collidePad,
    controls.collideBoxScale,
    controls.collideStrength,
    controls.collideIterations,
    controls.distMinMult,
    controls.distMaxMult,
    controls.chargeMult,
    forceSettings,
  ]);

  const fitView = useCallback(
    (duration = 0) => {
      const graph = graphRef.current;
      const camera = graph?.camera();
      if (!graph || !(camera instanceof PerspectiveCamera)) return;
      const view = fitPhotoGraph3DView(
        data.nodes,
        dimensions.width / dimensions.height,
        camera.fov,
      );
      if (!view) return;
      resetAnimationRef.current?.stop();
      resetAnimationRef.current = null;
      const orbit = graph.controls() as OrbitControls;
      orbit.enableDamping = !reducedMotion;
      if (!duration) {
        graph.cameraPosition(view.camera, view.target, 0);
        return;
      }
      const fromCamera = camera.position.clone();
      const fromTarget = orbit.target.clone();
      orbit.enableDamping = false;
      resetAnimationRef.current = animate(0, 1, {
        duration: duration / 1000,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (progress) => {
          camera.position.lerpVectors(fromCamera, view.camera, progress);
          orbit.target.lerpVectors(fromTarget, view.target, progress);
          orbit.update();
        },
        onComplete: () => {
          orbit.enableDamping = !reducedMotion;
          resetAnimationRef.current = null;
        },
      });
    },
    [data.nodes, dimensions.width, dimensions.height, reducedMotion],
  );

  useEffect(() => {
    if (resetRef.current === resetViewKey) return;
    resetRef.current = resetViewKey;
    fitView(reducedMotion ? 0 : GRAPH_CONFIG.resetViewDurationMs);
  }, [resetViewKey, fitView, reducedMotion]);

  useLayoutEffect(() => {
    const graph = graphRef.current;
    if (!ready || !graph) return;
    let resolutionQuery: MediaQueryList | undefined;
    const updateResolution = () => {
      const dpr = window.devicePixelRatio || 1;
      const pixelRatio = photoGraphRenderPixelRatio(
        dimensions.width,
        dimensions.height,
        dpr,
      );
      const renderer = graph.renderer();
      const composer = graph.postProcessingComposer();
      const currentSize = renderer.getSize(new Vector2());
      // Lower density before changing dimensions. Cover both axes' old/new
      // maxima so canvas width/height setters cannot briefly over-allocate.
      const transitionRatio = Math.min(
        renderer.getPixelRatio(),
        photoGraphRenderPixelRatio(
          Math.max(currentSize.x, dimensions.width),
          Math.max(currentSize.y, dimensions.height),
          pixelRatio,
        ),
      );
      if (renderer.getPixelRatio() !== transitionRatio) {
        renderer.setPixelRatio(transitionRatio);
        composer.setPixelRatio(transitionRatio);
      }
      if (
        currentSize.x !== dimensions.width ||
        currentSize.y !== dimensions.height
      ) {
        renderer.setSize(dimensions.width, dimensions.height);
        composer.setSize(dimensions.width, dimensions.height);
      }
      if (pixelRatio !== transitionRatio) {
        renderer.setPixelRatio(pixelRatio);
        composer.setPixelRatio(pixelRatio);
      }
      resolutionQuery?.removeEventListener("change", updateResolution);
      resolutionQuery = window.matchMedia(`(resolution: ${dpr}dppx)`);
      resolutionQuery.addEventListener("change", updateResolution);
    };
    updateResolution();
    window.addEventListener("resize", updateResolution);
    return () => {
      resolutionQuery?.removeEventListener("change", updateResolution);
      window.removeEventListener("resize", updateResolution);
    };
  }, [ready, dimensions.width, dimensions.height]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!ready || !graph) return;
    const renderer = graph.renderer();
    const orbit = graph.controls() as OrbitControls;
    orbit.enableDamping = !reducedMotion;
    orbit.autoRotate = false;
    const stopReset = () => {
      resetAnimationRef.current?.stop();
      resetAnimationRef.current = null;
      orbit.enableDamping = !reducedMotion;
    };
    if (reducedMotion) stopReset();
    orbit.addEventListener("start", stopReset);
    const canvas = renderer.domElement;
    const detachPanModifier = attachPhotoGraphPanModifier(orbit, canvas);
    const contextLost = (event: Event) => {
      if (!canvas.isConnected) return;
      event.preventDefault();
      onFailure();
    };
    canvas.addEventListener("webglcontextlost", contextLost);
    return () => {
      detachPanModifier();
      stopReset();
      orbit.removeEventListener("start", stopReset);
      canvas.removeEventListener("webglcontextlost", contextLost);
    };
  }, [ready, reducedMotion, onFailure]);

  useLayoutEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const renderer = graph.renderer();
    return () => {
      const orbit = graph.controls() as OrbitControls;
      const saved = {
        data: sourceData,
        positions: snapshotPositions(data.nodes),
        camera: { ...graph.camera().position },
        target: { ...orbit.target },
        forceSettings,
      };
      // The wrapper owns scene/material/renderer disposal. Release only the
      // owned WebGL context, after React's Strict Mode replay has had a chance
      // to reconnect the canvas. Do not call the private graph destructor.
      queueMicrotask(() => {
        if (!renderer.domElement.isConnected) {
          onSaveSnapshot(saved);
          renderer.forceContextLoss();
        }
      });
    };
  }, [data, onSaveSnapshot, sourceData, forceSettings]);

  usePhotoGraphTextures({
    graphRef,
    nodes: data.nodes,
    spritesRef,
    dimensions,
    enabled: ready,
  });

  const handleEngineStop = useCallback(() => {
    const graph = graphRef.current;
    if (
      !ready ||
      !graph ||
      initializedCameraRef.current ||
      !data.nodes.length ||
      !Number.isFinite(data.nodes[0].x)
    )
      return;
    initializedCameraRef.current = true;
    if (restoredSnapshot && retainLayout) {
      const camera = restoredSnapshot.camera;
      const target = restoredSnapshot.target ?? { x: 0, y: 0, z: 0 };
      graph.cameraPosition(
        { ...camera, z: camera.z ?? 0 },
        { ...target, z: target.z ?? 0 },
        0,
      );
    } else {
      fitView();
    }
  }, [ready, data.nodes, restoredSnapshot, retainLayout, fitView]);

  const linkColor = useCallback(
    (link: PhotoGraphLink) => {
      const value = getPhotoGraphLinkValue(link);
      return activeDarkMode
        ? `rgba(255,255,255,${0.72 * value})`
        : `rgba(0,0,0,${value})`;
    },
    [activeDarkMode],
  );
  const linkVisibility = useCallback(
    (link: PhotoGraphLink) =>
      !controls.hideConnections && getPhotoGraphLinkValue(link) > 0,
    [controls.hideConnections],
  );

  return (
    <div className="size-full" data-graph-mode="3d">
      <ForceGraph3D
        ref={graphRef}
        graphData={ready ? data : EMPTY_GRAPH}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor={activeDarkMode ? "#000000" : "#ffffff"}
        controlType="orbit"
        rendererConfig={RENDERER_CONFIG}
        showNavInfo={false}
        numDimensions={3}
        nodeThreeObject={nodeObject}
        nodeLabel={() => ""}
        linkColor={linkColor}
        linkOpacity={1}
        linkVisibility={linkVisibility}
        linkWidth={0}
        d3AlphaMin={0}
        d3AlphaDecay={PHOTO_GRAPH_ALPHA_DECAY}
        warmupTicks={
          retainLayout
            ? 0
            : reducedMotion
              ? GRAPH_CONFIG.settleTicks
              : GRAPH_CONFIG.warmupTicks
        }
        cooldownTicks={
          retainLayout && !interacted
            ? 0
            : reducedMotion
              ? 60
              : GRAPH_CONFIG.settleTicks - GRAPH_CONFIG.warmupTicks
        }
        cooldownTime={Infinity}
        onEngineStop={handleEngineStop}
        onEngineTick={handleEngineStop}
        onNodeDrag={() => setInteracted(true)}
        onNodeClick={onInspect}
        showPointerCursor={(object) => Boolean(object && "sourceUrl" in object)}
      />
    </div>
  );
}
