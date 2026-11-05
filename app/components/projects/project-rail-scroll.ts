const HANDOFF_SPEED_RATIO = 1.25;

export function getRailAutoplayWeight(
  deltaPixels: number,
  deltaSeconds: number,
  animationSpeed: number,
) {
  const scrollSpeed = Math.abs(deltaPixels) / deltaSeconds;
  const progress =
    animationSpeed > 0
      ? Math.min(
          1,
          Math.max(
            0,
            (scrollSpeed - animationSpeed) /
              (animationSpeed * (HANDOFF_SPEED_RATIO - 1)),
          ),
        )
      : 1;
  const manualWeight = progress * progress * (3 - 2 * progress);

  return 1 - manualWeight;
}
