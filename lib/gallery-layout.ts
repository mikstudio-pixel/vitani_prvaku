export function galleryLayout(count: number, width: number, height: number) {
  const staggered = count > 1 && count % 2 === 1;
  const total = Math.max(1, count);
  const candidates = staggered ? [Math.ceil(total / 2)] : [Math.ceil(total / 2), total];
  let columns = candidates[0], rows = Math.ceil(total / columns), size = 0, gap = 0;
  for (const candidate of candidates) {
    const candidateRows = Math.ceil(total / candidate);
    const candidateGap = Math.min(12, width / candidate * .06, height / candidateRows * .06);
    const candidateSize = Math.max(0, Math.min(
      (width - candidateGap * (candidate - 1)) / candidate,
      (height - candidateGap * (candidateRows - 1)) / candidateRows,
    ));
    if (candidateSize > size) {
      columns = candidate; rows = candidateRows; size = candidateSize; gap = candidateGap;
    }
  }
  const positions = Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const length = Math.min(columns, count - row * columns);
    return { row: row + 1, column: (staggered ? columns - length : 0) + index % columns * 2 + 1 };
  });
  return { columns, rows, size, gap, positions };
}
