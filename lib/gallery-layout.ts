export function galleryLayout(count: number, width: number, height: number) {
  let columns = 1, rows = Math.max(1, count), size = 0, gap = 0;
  for (let candidate = 1; candidate <= Math.max(1, count); candidate++) {
    const candidateRows = Math.ceil(Math.max(1, count) / candidate);
    const candidateGap = Math.min(12, width / candidate * .06, height / candidateRows * .06);
    const candidateSize = Math.max(0, Math.min(
      (width - candidateGap * (candidate - 1)) / candidate,
      (height - candidateGap * (candidateRows - 1)) / candidateRows,
    ));
    if (candidateSize > size) {
      columns = candidate; rows = candidateRows; size = candidateSize; gap = candidateGap;
    }
  }
  return { columns, rows, size, gap };
}
