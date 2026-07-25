export function sequenceSegmentGeometry(
  start: number,
  end: number,
  proteinLength: number,
  width = 1000,
) {
  const x = ((start - 1) / proteinLength) * width;
  const segmentWidth = ((end - start + 1) / proteinLength) * width;
  return { x, width: Math.max(segmentWidth, 2) };
}
