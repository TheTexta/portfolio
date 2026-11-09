"use client";

import { useEffect, type RefObject } from "react";
import {
  LinearFilter,
  SRGBColorSpace,
  Texture,
  Vector3,
  type Sprite,
} from "three";
import type { ForceGraphMethods } from "react-force-graph-3d";

import { sizePhotoGraphNode } from "@/lib/photo-graph/force-graph";
import {
  buildOptimizedImageCandidates,
  pickAllowedWidth,
} from "./imageOptimizer";
import { GRAPH_CONFIG } from "./config";
import type { PhotoGraphLink, PhotoGraphNode } from "./types";
import { loadImage } from "./utils";
import {
  PHOTO_GRAPH_TEXTURE_BUDGET,
  PHOTO_GRAPH_MAX_TEXTURE_SIDE,
  photoGraphTextureSideLimit,
} from "./texture-budget";

type PhotoSprite = Sprite & {
  userData: { loadedWidth?: number; loadedAt?: number; bytes?: number };
};

type Props = {
  graphRef: RefObject<
    ForceGraphMethods<PhotoGraphNode, PhotoGraphLink> | undefined
  >;
  nodes: PhotoGraphNode[];
  spritesRef: RefObject<Map<string, PhotoSprite>>;
  dimensions: { width: number; height: number };
  enabled: boolean;
};

export function usePhotoGraphTextures({
  graphRef,
  nodes,
  spritesRef,
  dimensions,
  enabled,
}: Props) {
  useEffect(() => {
    const graph = graphRef.current;
    if (!enabled || !graph) return;
    const sprites = spritesRef.current;
    const abort = new AbortController();
    const failed = new Set<string>();
    const pending = new Set<string>();
    let queue: { node: PhotoGraphNode; width: number }[] = [];
    let visible = new Set<string>();
    let active = 0;
    let textureSideLimit = PHOTO_GRAPH_MAX_TEXTURE_SIDE;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const camera = graph.camera();
    const center = new Vector3();
    const edge = new Vector3();
    const right = new Vector3();

    const trimTextures = (incomingBytes: number, keepId: string) => {
      let bytes = [...sprites.values()].reduce(
        (sum, sprite) => sum + (sprite.userData.bytes ?? 0),
        0,
      );
      const candidates = [...sprites.entries()]
        .filter(
          ([id, sprite]) =>
            id !== keepId && !visible.has(id) && sprite.material.map,
        )
        .sort(
          ([idA, a], [idB, b]) =>
            Number(visible.has(idA)) - Number(visible.has(idB)) ||
            (a.userData.loadedAt ?? 0) - (b.userData.loadedAt ?? 0),
        );
      for (const [, sprite] of candidates) {
        if (bytes + incomingBytes <= PHOTO_GRAPH_TEXTURE_BUDGET) break;
        bytes -= sprite.userData.bytes ?? 0;
        sprite.material.map?.dispose();
        sprite.material.map = null;
        sprite.material.color.set(0x888888);
        sprite.material.needsUpdate = true;
        sprite.userData = {};
      }
      return bytes + incomingBytes <= PHOTO_GRAPH_TEXTURE_BUDGET;
    };

    const attachImage = (
      sprite: PhotoSprite,
      id: string,
      image: CanvasImageSource & { width: number; height: number },
      width: number,
    ) => {
      const scale = Math.min(
        1,
        textureSideLimit / Math.max(image.width, image.height),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(image.width * scale));
      canvas.height = Math.max(1, Math.floor(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const bytes = canvas.width * canvas.height * 4;
      sprite.material.map?.dispose();
      sprite.material.map = null;
      sprite.userData.bytes = 0;
      if (!trimTextures(bytes, id)) {
        sprite.material.color.set(0x888888);
        sprite.material.needsUpdate = true;
        sprite.userData = {};
        return;
      }
      const texture = new Texture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.needsUpdate = true;
      sprite.material.map = texture;
      sprite.material.color.set(0xffffff);
      sprite.material.needsUpdate = true;
      sprite.userData = {
        loadedWidth: width,
        loadedAt: performance.now(),
        bytes,
      };
    };

    const load = async (node: PhotoGraphNode, width: number) => {
      const sprite = sprites.get(node.id);
      if (!sprite) return;
      const candidates = buildOptimizedImageCandidates(
        node.storagePath,
        node.sourceUrl,
        width,
        undefined,
        node.storageProvider,
      );
      for (const url of candidates) {
        try {
          const image = await loadImage(url, abort.signal);
          if (abort.signal.aborted) return;
          if (
            !node.hasKnownAspectRatio &&
            image.naturalWidth &&
            image.naturalHeight
          ) {
            node.aspectRatio = image.naturalWidth / image.naturalHeight;
            node.hasKnownAspectRatio = true;
            sizePhotoGraphNode(node);
            sprite.scale.set(node.w, node.h, 1);
          }
          // Even the provider-aware original fallback must not upload an
          // unbounded archival image to the GPU.
          attachImage(sprite, node.id, image, width);
          return;
        } catch {
          if (abort.signal.aborted) return;
        }
      }
      failed.add(node.id);
    };

    const pump = () => {
      while (
        !abort.signal.aborted &&
        active < GRAPH_CONFIG.imageConcurrency &&
        queue.length
      ) {
        const request = queue.shift()!;
        if (pending.has(request.node.id)) continue;
        pending.add(request.node.id);
        active += 1;
        void load(request.node, request.width).finally(() => {
          active -= 1;
          pending.delete(request.node.id);
          if (!abort.signal.aborted) pump();
        });
      }
    };

    const update = () => {
      timer = undefined;
      if (abort.signal.aborted) return;
      camera.updateMatrixWorld();
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      const projected: {
        node: PhotoGraphNode;
        width: number;
        distance: number;
      }[] = [];
      visible = new Set();
      for (const node of nodes) {
        center.set(node.x ?? 0, node.y ?? 0, node.z ?? 0);
        edge
          .copy(center)
          .addScaledVector(right, node.w / 2)
          .project(camera);
        center.project(camera);
        const halfWidth = Math.abs(edge.x - center.x);
        const halfHeight =
          (halfWidth * dimensions.width) / dimensions.height / node.aspectRatio;
        if (
          center.z < -1 ||
          center.z > 1 ||
          Math.abs(center.x) > 1.3 + halfWidth ||
          Math.abs(center.y) > 1.3 + halfHeight
        )
          continue;
        visible.add(node.id);
        const sprite = sprites.get(node.id);
        if (!sprite) continue;
        const desired = Math.min(
          PHOTO_GRAPH_MAX_TEXTURE_SIDE,
          halfWidth *
            dimensions.width *
            Math.min(window.devicePixelRatio || 1, 1.5),
        );
        projected.push({
          node,
          width: desired,
          distance: Math.hypot(center.x, center.y),
        });
      }
      textureSideLimit = photoGraphTextureSideLimit(visible.size);
      for (const { node } of projected) {
        const sprite = sprites.get(node.id)!;
        const image = sprite.material.map?.image as
          HTMLCanvasElement | undefined;
        if (image && Math.max(image.width, image.height) > textureSideLimit) {
          attachImage(
            sprite,
            node.id,
            image,
            pickAllowedWidth(
              Math.min(
                sprite.userData.loadedWidth ?? image.width,
                textureSideLimit * Math.min(1, node.aspectRatio),
              ),
            ),
          );
        }
      }
      queue = projected
        .map((request) => ({
          ...request,
          width: pickAllowedWidth(
            Math.min(
              textureSideLimit * Math.min(1, request.node.aspectRatio),
              request.width,
            ),
          ),
        }))
        .filter(
          ({ node, width }) =>
            !failed.has(node.id) &&
            !pending.has(node.id) &&
            (sprites.get(node.id)?.userData.loadedWidth ?? 0) < width,
        )
        .sort((a, b) => a.distance - b.distance);
      pump();
    };
    const schedule = () => {
      timer ??= setTimeout(update, 150);
    };
    // OrbitControls emits change for pan, orbit, pinch and wheel; the force
    // engine also moves nodes without a camera change.
    const controls = graph.controls() as {
      addEventListener: (type: "change", fn: () => void) => void;
      removeEventListener: (type: "change", fn: () => void) => void;
    };
    controls.addEventListener("change", schedule);
    const interval = setInterval(schedule, 500);
    schedule();
    return () => {
      abort.abort();
      clearTimeout(timer);
      clearInterval(interval);
      controls.removeEventListener("change", schedule);
      // Attached maps belong to force-graph's scene destructor. Superseded maps
      // are disposed above; aborted requests cannot attach after unmount.
    };
  }, [
    graphRef,
    nodes,
    spritesRef,
    dimensions.width,
    dimensions.height,
    enabled,
  ]);
}
