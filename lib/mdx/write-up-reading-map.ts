export type ReadingMapPoint = { documentY: number; railY: number };

export function overlapsReadingWindow(
  visible: { top: number; height: number },
  marker: { top: number; bottom: number },
) {
  return (
    visible.height > 0 &&
    marker.bottom >= visible.top &&
    marker.top <= visible.top + visible.height
  );
}

// The title is a separate fixed row. Only a substantial gap inside the content
// becomes a flexible introduction spacer, matching the upstream layout model.
export function getSectionScales(
  headings: number[],
  contentStart: number,
  contentEnd: number,
) {
  const length = contentEnd - contentStart;
  if (length <= 0) return { intro: 0, sections: headings.map(() => 0) };
  const introLength = (headings[0] ?? contentStart) - contentStart;
  return {
    intro: introLength > 50 ? (introLength / length) * 100 : 0,
    sections: headings.map(
      (position, index) =>
        (Math.max(0, (headings[index + 1] ?? contentEnd) - position) / length) *
        100,
    ),
  };
}

// Match the visible document range to the actual marker positions, including
// the space labels need when short sections cannot shrink any further.
export function getReadingWindow(
  points: ReadingMapPoint[],
  viewportTop: number,
  viewportBottom: number,
  railHeight: number,
) {
  const stops: ReadingMapPoint[] = [];
  for (const point of points) {
    const previous = stops.at(-1);
    if (
      !previous ||
      (point.documentY > previous.documentY && point.railY > previous.railY)
    )
      stops.push(point);
  }
  if (stops.length < 2 || railHeight <= 0) return { top: 0, height: 0 };

  const project = (position: number) => {
    for (let index = 1; index < stops.length; index++) {
      const start = stops[index - 1];
      const end = stops[index];
      if (position <= end.documentY) {
        const fraction = Math.max(
          0,
          (position - start.documentY) / (end.documentY - start.documentY),
        );
        return start.railY + fraction * (end.railY - start.railY);
      }
    }
    return stops[stops.length - 1].railY;
  };

  const top = project(viewportTop);
  const height = Math.min(
    railHeight,
    Math.max(10, project(viewportBottom) - top),
  );
  return { top: Math.max(0, Math.min(top, railHeight - height)), height };
}
