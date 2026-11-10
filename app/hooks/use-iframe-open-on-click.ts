import { useCallback, useEffect, useRef, type RefObject } from "react";

const PREVIEW_NAVIGATION_SOURCE = "dextery-preview-navigation";
const FALLBACK_DELAY_MS = 650;

function getPageHref(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function useIframeOpenOnClick(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  fallbackHref: string,
  previewSrc: string,
  enabled = true,
) {
  const pointerInsideRef = useRef(false);
  const bridgeReadyRef = useRef(false);
  const fallbackTimerRef = useRef<number | null>(null);
  const removeFrameClickRef = useRef<(() => void) | null>(null);

  const clearFallback = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const openFallback = useCallback(() => {
    clearFallback();
    window.location.assign(fallbackHref);
  }, [clearFallback, fallbackHref]);

  const openPage = useCallback(
    (value: unknown) => {
      const href = getPageHref(value);
      if (!href) {
        return;
      }

      const pageUrl = new URL(href);
      const previewUrl = new URL(previewSrc, window.location.href);
      const fullUrl = new URL(fallbackHref, window.location.href);
      if (
        pageUrl.origin === previewUrl.origin &&
        pageUrl.pathname === previewUrl.pathname &&
        pageUrl.search === previewUrl.search &&
        fullUrl.origin === previewUrl.origin &&
        fullUrl.pathname === previewUrl.pathname
      ) {
        pageUrl.search = fullUrl.search;
      }

      clearFallback();
      window.location.assign(pageUrl.href);
    },
    [clearFallback, fallbackHref, previewSrc],
  );

  const attachFrameClick = useCallback(() => {
    if (!enabled) return;

    removeFrameClickRef.current?.();
    removeFrameClickRef.current = null;

    // Same-origin links can be read directly; external sites use postMessage.
    const frame = iframeRef.current;
    let frameDocument: Document | null | undefined;
    try {
      frameDocument = frame?.contentDocument;
    } catch {
      return;
    }
    if (
      !frame ||
      !frameDocument ||
      frameDocument.readyState !== "complete" ||
      frameDocument.URL === "about:blank"
    ) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const anchor = target?.closest?.<HTMLAnchorElement>("a[href]");
      const navigationButton = target?.closest?.<HTMLElement>(
        "[data-preview-href]",
      );
      const declaredHref =
        anchor?.href ?? navigationButton?.getAttribute("data-preview-href");
      let href: string | null = null;
      if (declaredHref) {
        try {
          href = new URL(declaredHref, frameDocument.baseURI).href;
        } catch {
          // An invalid destination opens the project's main site.
        }
      }

      if (getPageHref(href)) {
        event.preventDefault();
        openPage(href);
      } else if (href?.startsWith("mailto:") || href?.startsWith("tel:")) {
        clearFallback();
      } else {
        event.preventDefault();
        event.stopPropagation();
        openFallback();
      }
    };

    frameDocument.addEventListener("click", handleClick, true);
    removeFrameClickRef.current = () =>
      frameDocument.removeEventListener("click", handleClick, true);
    bridgeReadyRef.current = true;
    frame.dataset.previewNavigationReady = "true";
    clearFallback();
  }, [clearFallback, enabled, iframeRef, openFallback, openPage]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    bridgeReadyRef.current = false;
    const frame = iframeRef.current;
    if (frame) delete frame.dataset.previewNavigationReady;
    const previewOrigin = new URL(previewSrc, window.location.href).origin;

    const handleMessage = (event: MessageEvent) => {
      if (
        event.source !== iframeRef.current?.contentWindow ||
        event.origin !== previewOrigin ||
        event.data?.source !== PREVIEW_NAVIGATION_SOURCE ||
        (event.data.type !== "open-link" &&
          event.data.type !== "open-site" &&
          event.data.type !== "ready" &&
          event.data.type !== "keep-native")
      ) {
        return;
      }

      if (event.data.type === "ready") {
        bridgeReadyRef.current = true;
        const currentFrame = iframeRef.current;
        if (currentFrame) currentFrame.dataset.previewNavigationReady = "true";
        clearFallback();
        return;
      }

      if (event.data.type === "keep-native") {
        clearFallback();
        return;
      }

      if (event.data.type === "open-site") {
        openFallback();
        return;
      }

      openPage(event.data.href);
    };

    // Focusing an iframe blurs its parent. Give a clicked link time to report
    // its destination before opening the project's home page as a fallback.
    const handleWindowBlur = () => {
      if (
        !pointerInsideRef.current ||
        bridgeReadyRef.current ||
        document.visibilityState !== "visible" ||
        document.activeElement !== iframeRef.current
      ) {
        return;
      }

      clearFallback();
      fallbackTimerRef.current = window.setTimeout(
        openFallback,
        FALLBACK_DELAY_MS,
      );
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("blur", handleWindowBlur);
    // A cached same-origin iframe may load before this effect subscribes.
    attachFrameClick();
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("blur", handleWindowBlur);
      removeFrameClickRef.current?.();
      removeFrameClickRef.current = null;
      if (frame) delete frame.dataset.previewNavigationReady;
      clearFallback();
    };
  }, [
    attachFrameClick,
    clearFallback,
    enabled,
    iframeRef,
    openFallback,
    openPage,
    previewSrc,
  ]);

  return {
    onLoad: attachFrameClick,
    onPointerEnter: () => {
      pointerInsideRef.current = true;
    },
    onPointerLeave: () => {
      pointerInsideRef.current = false;
    },
    onMouseEnter: () => {
      pointerInsideRef.current = true;
    },
    onMouseLeave: () => {
      pointerInsideRef.current = false;
    },
  };
}
