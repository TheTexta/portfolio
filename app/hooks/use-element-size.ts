"use client";

import { type RefObject, useEffect, useState } from "react";

export type ElementSize = {
  width: number;
  height: number;
};

const EMPTY_SIZE: ElementSize = { width: 0, height: 0 };

export function useElementSize<T extends HTMLElement>(
  elementRef: RefObject<T | null>,
  { preserveLastNonZero = false }: { preserveLastNonZero?: boolean } = {},
) {
  const [size, setSize] = useState<ElementSize>(EMPTY_SIZE);

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    const updateSize = ({ width, height }: ElementSize) => {
      if (preserveLastNonZero && (width <= 0 || height <= 0)) {
        return;
      }

      setSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };

    updateSize(element.getBoundingClientRect());

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) {
        updateSize(entry.contentRect);
      }
    });
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [elementRef, preserveLastNonZero]);

  return size;
}
