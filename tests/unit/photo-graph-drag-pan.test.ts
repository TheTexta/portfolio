import { describe, expect, it } from "vitest";
import { Spherical, Vector2, Vector3 } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { attachPhotoGraphPanModifier } from "@/app/components/projects/photo-graph/drag-pan-modifier";

type TestEvent = { type: string; target?: unknown; [key: string]: unknown };
class TestPointerEvent {
  [key: string]: unknown;
  constructor(
    public type: string,
    init = {},
  ) {
    Object.assign(this, init);
  }
}
class Target {
  listeners = new Map<string, Set<(event: TestEvent) => void>>();
  addEventListener(
    type: string,
    listener: (event: TestEvent) => void,
    capture = false,
  ) {
    type = `${type}:${capture}`;
    const entries = this.listeners.get(type) ?? new Set();
    entries.add(listener);
    this.listeners.set(type, entries);
  }
  removeEventListener(
    type: string,
    listener: (event: TestEvent) => void,
    capture = false,
  ) {
    this.listeners.get(`${type}:${capture}`)?.delete(listener);
  }
  deliver(event: TestEvent, capture: boolean) {
    for (const listener of this.listeners.get(`${event.type}:${capture}`) ??
      []) {
      if (event.stopped) break;
      listener(event);
    }
  }
  emit(type: string, data: Record<string, unknown> = {}) {
    const event: TestEvent = {
      type,
      target: this,
      ...data,
      stopImmediatePropagation() {
        event.stopped = true;
      },
    };
    this.deliver(event, true);
    this.deliver(event, false);
    return event;
  }
  get count() {
    return [...this.listeners.values()].reduce(
      (sum, entries) => sum + entries.size,
      0,
    );
  }
}

function fixture() {
  const view = Object.assign(new Target(), { PointerEvent: TestPointerEvent });
  const document = Object.assign(new Target(), { defaultView: view });
  const controls = {
    enabled: true,
    enableRotate: true,
    enablePan: true,
    mouseButtons: { LEFT: 0 },
    state: -1,
    _rotateStart: new Vector2(),
    _panStart: new Vector2(),
    _sphericalDelta: new Spherical(0, 0.5, 0.25),
    _panOffset: new Vector3(2, 3, 4),
  };
  const events: string[] = [];
  const dispatched: TestEvent[] = [];
  const captures = new Set<number>();
  const canvas = {
    ownerDocument: document,
    isConnected: true,
    hasPointerCapture: (id: number) => captures.has(id),
    releasePointerCapture: (id: number) => {
      captures.delete(id);
    },
    releasePhotograph: () => {},
    dispatchEvent(event: TestEvent) {
      events.push(event.type);
      dispatched.push(event);
      event.target = canvas;
      if (canvas.isConnected) document.deliver(event, true);
      if (event.type === "pointercancel") controls.state = -1;
      if (event.type === "pointerleave") canvas.releasePhotograph();
      if (canvas.isConnected && event.bubbles) document.deliver(event, false);
      return true;
    },
  };
  const dispose = attachPhotoGraphPanModifier(
    controls as unknown as OrbitControls,
    canvas as unknown as HTMLCanvasElement,
  );
  const pointer = {
    pointerId: 1,
    pointerType: "mouse",
    clientX: 100,
    clientY: 200,
    isPrimary: true,
    button: 0,
    buttons: 1,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
  };
  const down = (overrides = {}) => {
    const data = { ...pointer, ...overrides };
    controls.state =
      data.shiftKey || data.ctrlKey || data.metaKey || data.button === 2
        ? 2
        : 0;
    document.emit("pointerdown", { ...data, target: canvas });
  };
  return {
    controls,
    document,
    view,
    canvas,
    dispose,
    pointer,
    down,
    events,
    dispatched,
    captures,
  };
}

describe("Photo Graph mid-drag Shift modifier", () => {
  it("rebases both actions and clears residual damping without moving the camera", () => {
    const f = fixture();
    f.down();
    f.document.emit("pointermove", {
      ...f.pointer,
      clientX: 125,
      clientY: 210,
    });
    f.view.emit("keydown", { key: "Shift", shiftKey: true });
    expect(f.controls.state).toBe(2);
    expect(f.controls._rotateStart.toArray()).toEqual([125, 210]);
    expect(f.controls._panStart.toArray()).toEqual([125, 210]);
    expect(f.controls._sphericalDelta).toEqual(new Spherical(0, 0, 0));
    expect(f.controls._panOffset.toArray()).toEqual([0, 0, 0]);
    f.document.emit("pointermove", {
      ...f.pointer,
      shiftKey: true,
      clientX: 140,
      clientY: 220,
    });
    f.view.emit("keyup", { key: "Shift", shiftKey: false });
    expect(f.controls.state).toBe(0);
    expect(f.controls._rotateStart.toArray()).toEqual([140, 220]);
    expect(f.controls._panStart.toArray()).toEqual([140, 220]);
    expect(f.events).toEqual([]);
    f.dispose();
  });

  it("reconciles missed key events from movement using the previous baseline", () => {
    const f = fixture();
    f.down();
    f.document.emit("pointermove", {
      ...f.pointer,
      shiftKey: true,
      clientX: 130,
    });
    expect(f.controls.state).toBe(2);
    expect(f.controls._panStart.x).toBe(100);
    f.document.emit("pointermove", {
      ...f.pointer,
      shiftKey: false,
      clientX: 150,
    });
    expect(f.controls.state).toBe(0);
    expect(f.controls._rotateStart.x).toBe(130);
    f.dispose();
  });

  it("handles Shift held before pointer-down and preserves Ctrl/Meta-started panning", () => {
    const f = fixture();
    f.down({ shiftKey: true });
    f.view.emit("keyup", { key: "Shift", shiftKey: false });
    expect(f.controls.state).toBe(0);
    f.document.emit("pointerup", f.pointer);
    f.down({ ctrlKey: true });
    f.view.emit("keydown", { key: "Shift", shiftKey: true });
    f.view.emit("keyup", { key: "Shift", shiftKey: false });
    expect(f.controls.state).toBe(2);
    f.dispose();
  });

  it("does not override photograph dragging, right-drag or touch actions", () => {
    const f = fixture();
    f.controls.enabled = false;
    f.down();
    f.view.emit("keydown", { key: "Shift", shiftKey: true });
    expect(f.controls.enabled).toBe(false);
    expect(f.controls.state).toBe(0);
    f.document.emit("pointerup", f.pointer);
    f.controls.enabled = true;
    f.down({ button: 2, buttons: 2 });
    f.view.emit("keyup", { key: "Shift", shiftKey: false });
    expect(f.controls.state).toBe(2);
    f.document.emit("pointerup", f.pointer);
    f.down({ pointerType: "touch" });
    f.controls.state = 5;
    f.view.emit("keydown", { key: "Shift", shiftKey: true });
    expect(f.controls.state).toBe(5);
    f.dispose();
  });

  it("cancels on blur without synthetic primary clicks and cleans listeners", async () => {
    const f = fixture();
    f.down();
    f.view.emit("blur");
    await Promise.resolve();
    expect(f.events).toContain("pointercancel");
    expect(f.events).toContain("pointerleave");
    expect(f.events).toContain("pointerup");
    expect(
      f.dispatched
        .filter((event) => event.type === "pointerup")
        .every((event) => event.button === -1),
    ).toBe(true);
    expect(f.controls.state).toBe(-1);
    f.dispose();
    f.dispose();
    expect(f.document.count).toBe(0);
    expect(f.view.count).toBe(0);
  });

  it("releases a photograph even when disposal happens after the canvas detached", () => {
    const f = fixture();
    f.controls.enabled = false;
    f.down();
    let released = false;
    f.canvas.releasePhotograph = () => {
      released = true;
      f.controls.enabled = true;
    };
    f.canvas.isConnected = false;
    f.dispose();
    expect(released).toBe(true);
    expect(f.controls.enabled).toBe(true);
    expect(f.document.count).toBe(0);
  });

  it("keeps held-button moves suppressed after the neutral reset, until a real release or fresh press", async () => {
    const f = fixture();
    f.down();
    f.view.emit("blur");
    await Promise.resolve();
    expect(
      f.dispatched.find((event) => event.type === "pointerup")?.bubbles,
    ).toBe(false);
    expect(f.document.emit("pointermove", f.pointer).stopped).toBe(true);
    // Button -1 is not itself a synthetic-event identity.
    f.document.emit("pointerup", { ...f.pointer, button: -1, buttons: 0 });
    expect(f.document.emit("pointermove", f.pointer).stopped).not.toBe(true);
    f.down();
    f.view.emit("blur");
    await Promise.resolve();
    expect(f.document.emit("pointermove", f.pointer).stopped).toBe(true);
    f.down();
    expect(f.document.emit("pointermove", f.pointer).stopped).not.toBe(true);
    f.dispose();
  });

  it("releases each captured pointer without bubbling reset-ups into native controls", async () => {
    const f = fixture();
    f.down({ pointerType: "touch" });
    f.down({ pointerType: "touch", pointerId: 2 });
    f.captures.add(1);
    f.captures.add(2);
    let nativeUps = 0;
    const onUp = () => {
      nativeUps += 1;
    };
    f.document.addEventListener("pointerup", onUp);
    f.view.emit("blur");
    await Promise.resolve();
    expect(f.captures.size).toBe(0);
    expect(
      f.dispatched.filter((event) => event.type === "pointerup"),
    ).toHaveLength(2);
    expect(nativeUps).toBe(0);
    f.document.removeEventListener("pointerup", onUp);
    f.dispose();
  });

  it("falls back to native controls if the dependency's internal seam changes", () => {
    const f = fixture();
    f.dispose();
    const incompatible = { ...f.controls, _panStart: undefined };
    const dispose = attachPhotoGraphPanModifier(
      incompatible as unknown as OrbitControls,
      f.canvas as unknown as HTMLCanvasElement,
    );
    expect(f.document.count).toBe(0);
    expect(f.view.count).toBe(0);
    expect(() => dispose()).not.toThrow();
  });
});
