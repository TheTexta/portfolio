import type { PhotoGraphNode } from "./types";

type ImageRequest = {
  node: PhotoGraphNode;
  width: number;
  promise: Promise<void>;
  resolve: () => void;
};

/** One request per photograph at a time; pending upgrades merge without
 * cancelling a thumbnail that is already loading. Promises settle on completion
 * or cancellation; the loader owns reporting individual image failures. */
export function createPhotoGraphImageQueue(
  load: (node: PhotoGraphNode, width: number) => Promise<void>,
  concurrency: number,
) {
  const pending = new Map<string, ImageRequest>();
  const active = new Map<string, ImageRequest>();
  let disposed = false;

  const drain = () => {
    if (disposed) return;
    for (const [id, request] of pending) {
      if (active.size >= concurrency) break;
      if (active.has(id)) continue;
      pending.delete(id);
      active.set(id, request);
      const finish = () => {
        active.delete(id);
        request.resolve();
        drain();
      };
      void Promise.resolve()
        .then(() => {
          if (!disposed) return load(request.node, request.width);
        })
        .then(finish, finish);
    }
  };

  return {
    enqueue(node: PhotoGraphNode, width: number) {
      if (disposed) return Promise.resolve();
      // An active loader can lower its actual width after sampling current
      // demand. Retain one follow-up scan even when its enqueued width was larger.
      const waiting = pending.get(node.id);
      if (waiting) {
        waiting.width = Math.max(waiting.width, width);
        return waiting.promise;
      }
      let resolve!: () => void;
      const promise = new Promise<void>((complete) => {
        resolve = complete;
      });
      pending.set(node.id, { node, width, promise, resolve });
      drain();
      return promise;
    },
    dispose() {
      disposed = true;
      pending.forEach((request) => request.resolve());
      pending.clear();
    },
  };
}
