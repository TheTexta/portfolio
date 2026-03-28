export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function clearTimeoutRef(timeoutRef: { current: number | null }) {
  if (timeoutRef.current === null) {
    return;
  }

  window.clearTimeout(timeoutRef.current);
  timeoutRef.current = null;
}

export function getCurrentDevicePixelRatio() {
  return typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
}

export function loadImage(url: string, signal: AbortSignal) {
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

export function buildInspectFilename(
  id: string,
  sourceUrl: string,
  mimeType?: string,
) {
  const typeExtension = mimeType?.split("/")[1]?.split("+")[0];
  if (typeExtension) {
    return `${id}.${typeExtension}`;
  }

  try {
    const { pathname } = new URL(sourceUrl);
    const extension = pathname.split(".").pop();
    if (extension && extension !== pathname) {
      return `${id}.${extension}`;
    }
  } catch {
    return `${id}.png`;
  }

  return `${id}.png`;
}

export function convertSizeToMb(sizeInBytes: number) {
  return sizeInBytes / (1024 * 1024);
}
