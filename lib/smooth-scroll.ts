export const SITE_SCROLL_DURATION_MS = 450;

function easeOutQuint(progress: number) {
  return 1 - (1 - progress) ** 5;
}

export function scrollToElement(element: Element) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element.scrollIntoView({ block: "start" });
    return;
  }

  const startTop = window.scrollY;
  const targetTop = Math.max(
    0,
    startTop + element.getBoundingClientRect().top - 48,
  );
  const startedAt = window.performance.now();

  function step(timestamp: number) {
    const elapsed = timestamp - startedAt;
    const progress = Math.min(elapsed / SITE_SCROLL_DURATION_MS, 1);
    const nextTop = startTop + (targetTop - startTop) * easeOutQuint(progress);

    window.scrollTo({ top: nextTop, behavior: "auto" });

    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  }

  window.requestAnimationFrame(step);
}