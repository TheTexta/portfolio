import { MOUSE, type Spherical, type Vector2, type Vector3 } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Three r187 latches the action at pointer-down. Keep its version-sensitive
// state/baseline seam here, rather than replacing its camera or pointer maths.
type DragState = {
  state: number;
  _rotateStart: Vector2;
  _panStart: Vector2;
  _sphericalDelta: Spherical;
  _panOffset: Vector3;
};
const ROTATE = 0;
const PAN = 2;

export function attachPhotoGraphPanModifier(
  orbit: OrbitControls,
  canvas: HTMLCanvasElement,
) {
  const candidate = orbit as OrbitControls & Partial<DragState>;
  const document = canvas.ownerDocument;
  const view = document.defaultView;
  if (
    !view ||
    typeof view.PointerEvent !== "function" ||
    typeof candidate.state !== "number" ||
    typeof candidate._rotateStart?.set !== "function" ||
    typeof candidate._panStart?.set !== "function" ||
    typeof candidate._sphericalDelta?.set !== "function" ||
    typeof candidate._panOffset?.set !== "function"
  )
    return () => {};
  const controls = candidate as OrbitControls & DragState;
  type Pointer = {
    pointerId: number;
    pointerType: string;
    clientX: number;
    clientY: number;
    isPrimary: boolean;
  };
  const pointers = new Map<number, Pointer>();
  const resetUps = new WeakSet<PointerEvent>();
  let cancelledMouse: number | undefined;
  let gesture:
    { pointerId: number; x: number; y: number; basePan: boolean } | undefined;

  const clearDamping = () => {
    controls._sphericalDelta.set(0, 0, 0);
    controls._panOffset.set(0, 0, 0);
  };
  const switchMode = (shift: boolean) => {
    if (!gesture) return;
    if (
      !orbit.enabled ||
      (controls.state !== ROTATE && controls.state !== PAN)
    ) {
      gesture = undefined;
      return;
    }
    const pan = shift || gesture.basePan;
    const next = pan ? PAN : ROTATE;
    if (
      next === controls.state ||
      (pan ? !orbit.enablePan : !orbit.enableRotate)
    )
      return;
    controls._rotateStart.set(gesture.x, gesture.y);
    controls._panStart.set(gesture.x, gesture.y);
    clearDamping();
    controls.state = next;
  };
  const pointerData = (event: PointerEvent): Pointer => ({
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    clientX: event.clientX,
    clientY: event.clientY,
    isPrimary: event.isPrimary,
  });
  const downCapture = (event: PointerEvent) => {
    if (event.pointerType === "mouse") cancelledMouse = undefined;
  };
  const down = (event: PointerEvent) => {
    // Document bubbling runs after native canvas handlers, including photograph
    // DragControls, which may have disabled orbit for a selected photograph.
    if (event.target !== canvas) {
      gesture = undefined;
      return;
    }
    pointers.set(event.pointerId, pointerData(event));
    gesture = undefined;
    if (
      pointers.size !== 1 ||
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      event.buttons !== 1 ||
      !orbit.enabled ||
      orbit.mouseButtons.LEFT !== MOUSE.ROTATE ||
      (controls.state !== ROTATE && controls.state !== PAN)
    )
      return;
    gesture = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      basePan: event.ctrlKey || event.metaKey,
    };
  };
  const move = (event: PointerEvent) => {
    if (cancelledMouse === event.pointerId) {
      if (event.buttons === 0) cancelledMouse = undefined;
      else {
        event.stopImmediatePropagation();
        return;
      }
    }
    if (pointers.has(event.pointerId))
      pointers.set(event.pointerId, pointerData(event));
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (event.buttons !== 1) {
      gesture = undefined;
      return;
    }
    // Capture precedes the native document move handler. Rebase at the previous
    // point, so the current movement segment is processed exactly once.
    switchMode(event.shiftKey);
    if (gesture) {
      gesture.x = event.clientX;
      gesture.y = event.clientY;
    }
  };
  const up = (event: PointerEvent) => {
    if (resetUps.has(event)) return;
    if (cancelledMouse === event.pointerId) cancelledMouse = undefined;
    pointers.delete(event.pointerId);
    if (gesture?.pointerId === event.pointerId) gesture = undefined;
  };
  const cancel = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    if (gesture?.pointerId === event.pointerId) clearDamping();
    up(event);
    if (event.pointerType === "mouse") cancelledMouse = event.pointerId;
    // DragControls has pointerleave/up cleanup but no pointercancel listener.
    canvas.dispatchEvent(
      new view.PointerEvent("pointerleave", pointerData(event)),
    );
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    // three-render-objects r1.43 clears its pressed/drag flags only on pointerup.
    // A neutral button cannot inspect (only 0/2 do), nor synthesize a DOM click.
    // Let the original cancellation finish native OrbitControls cleanup first.
    queueMicrotask(() => {
      // Ancestor capture resets the renderer; no document-bubbling OrbitControls
      // pointer-up is needed, especially while another touch is still active.
      const resetUp = new view.PointerEvent("pointerup", {
        ...pointerData(event),
        button: -1,
        buttons: 0,
        bubbles: false,
      });
      resetUps.add(resetUp);
      canvas.dispatchEvent(resetUp);
      resetUps.delete(resetUp);
    });
  };
  const key = (event: KeyboardEvent) => {
    if (event.key === "Shift") switchMode(event.shiftKey);
  };
  const cancelAll = () => {
    for (const pointer of [...pointers.values()]) {
      canvas.dispatchEvent(
        new view.PointerEvent("pointercancel", { ...pointer, bubbles: true }),
      );
      // Detached elements do not reach the document capture listener.
      if (pointers.has(pointer.pointerId))
        cancel(new view.PointerEvent("pointercancel", pointer));
    }
    // The canvas may already be detached during React unmount.
    if (gesture) clearDamping();
    gesture = undefined;
    pointers.clear();
  };
  document.addEventListener("pointerdown", downCapture, true);
  document.addEventListener("pointerdown", down);
  document.addEventListener("pointermove", move, true);
  document.addEventListener("pointerup", up, true);
  document.addEventListener("pointercancel", cancel, true);
  view.addEventListener("keydown", key);
  view.addEventListener("keyup", key);
  view.addEventListener("blur", cancelAll);
  return () => {
    cancelAll();
    document.removeEventListener("pointerdown", downCapture, true);
    document.removeEventListener("pointerdown", down);
    document.removeEventListener("pointermove", move, true);
    document.removeEventListener("pointerup", up, true);
    document.removeEventListener("pointercancel", cancel, true);
    view.removeEventListener("keydown", key);
    view.removeEventListener("keyup", key);
    view.removeEventListener("blur", cancelAll);
  };
}
