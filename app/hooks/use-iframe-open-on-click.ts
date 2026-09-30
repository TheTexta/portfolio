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

  useEffect(() => {
    bridgeReadyRef.current = false;
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
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("blur", handleWindowBlur);
      removeFrameClickRef.current?.();
      clearFallback();
    };
  }, [clearFallback, iframeRef, openFallback, openPage, previewSrc]);

  return {
    onLoad: () => {
      removeFrameClickRef.current?.();
      removeFrameClickRef.current = null;

      // The Grailed Plus iframe shares this origin, so its links can be read
      // without changing the embedded page. External sites use postMessage.
      let frameDocument: Document | null | undefined;
      try {
        frameDocument = iframeRef.current?.contentDocument;
      } catch {
        return;
      }
      if (!frameDocument) {
        return;
      }

      bridgeReadyRef.current = true;

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
    },
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
