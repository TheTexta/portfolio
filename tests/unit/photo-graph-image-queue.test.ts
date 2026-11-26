import { expect, it, vi } from "vitest";
import { createPhotoGraphImageQueue } from "@/app/components/projects/photo-graph/image-request-queue";
import type { PhotoGraphNode } from "@/app/components/projects/photo-graph/types";

const node = (id: string) => ({ id }) as PhotoGraphNode;

it("bounds requests, deduplicates upgrades, and never replaces an active thumbnail", async () => {
  const pending: (() => void)[] = [];
  const load = vi.fn<(node: PhotoGraphNode, width: number) => Promise<void>>(
    () => new Promise<void>((resolve) => pending.push(resolve)),
  );
  const queue = createPhotoGraphImageQueue(load, 2);
  const first = queue.enqueue(node("first"), 192);
  const second = queue.enqueue(node("second"), 192);
  const upgrade = queue.enqueue(node("first"), 384);
  expect(queue.enqueue(node("first"), 768)).toBe(upgrade);
  const third = queue.enqueue(node("third"), 192);
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  expect(load.mock.calls.map(([, width]) => width)).toEqual([192, 192]);
  pending[1]();
  await second;
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(3));
  expect(load.mock.calls[2]).toEqual([node("third"), 192]);
  pending[0]();
  await first;
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(4));
  expect(load.mock.calls[3]).toEqual([node("first"), 768]);
  pending[2]();
  pending[3]();
  await Promise.all([third, upgrade]);
});

it("releases failed slots and does not restart a disposed queue", async () => {
  let reject!: (error: Error) => void;
  const load = vi.fn(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
  );
  const queue = createPhotoGraphImageQueue(load, 1);
  const first = queue.enqueue(node("first"), 192);
  const second = queue.enqueue(node("second"), 192);
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  queue.dispose();
  reject(new Error("Aborted"));
  await Promise.all([first, second]);
  await queue.enqueue(node("third"), 192);
  expect(load).toHaveBeenCalledTimes(1);

  const recoveringLoad = vi
    .fn()
    .mockRejectedValueOnce(new Error("Image unavailable"))
    .mockResolvedValue(undefined);
  const recoveringQueue = createPhotoGraphImageQueue(recoveringLoad, 1);
  await Promise.all([
    recoveringQueue.enqueue(node("first"), 192),
    recoveringQueue.enqueue(node("second"), 192),
  ]);
  expect(recoveringLoad).toHaveBeenCalledTimes(2);
});

it("does not drop a newer target when an active request resamples a lower width", async () => {
  let demand = 384;
  let complete!: () => void;
  const actualWidths: number[] = [];
  const queue = createPhotoGraphImageQueue(async () => {
    actualWidths.push(demand);
    if (actualWidths.length === 1)
      await new Promise<void>((resolve) => (complete = resolve));
  }, 1);
  const first = queue.enqueue(node("first"), 768);
  await vi.waitFor(() => expect(actualWidths).toEqual([384]));
  demand = 576;
  const next = queue.enqueue(node("first"), demand);
  complete();
  await Promise.all([first, next]);
  expect(actualWidths).toEqual([384, 576]);
});
