// Cross-origin documents cannot inherit scrollbar styles from the portfolio.
// Draw their scrollbar edges outside the overflow-hidden preview, keeping native
// wheel, touch and keyboard scrolling instead of using scrolling="no".
export const PREVIEW_SCROLLBAR_GUTTER = 24;

export function getPreviewFrameSize(
  width: number,
  height: number,
  scale: number,
) {
  return {
    width: width / scale + PREVIEW_SCROLLBAR_GUTTER,
    height: height / scale + PREVIEW_SCROLLBAR_GUTTER,
  };
}
