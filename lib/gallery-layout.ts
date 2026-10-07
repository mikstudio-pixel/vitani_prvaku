export function galleryLayout(count: number, width: number, height: number) {
  const staggered = count > 1 && count % 2 === 1;
  const rowCounts = (columns: number) => {
    const result: number[] = [];
    for (let remaining = count; remaining > 0;) {
      const capacity = staggered && result.length % 2 === 1 ? columns - 1 : columns;
      const length = Math.min(remaining, capacity);
      result.push(length); remaining -= length;
    }
    return result;
  };
  let columns = staggered ? 2 : 1, rows = Math.max(1, rowCounts(columns).length), size = 0, gap = 0;
  const maximum = staggered ? Math.ceil(count / 2) : Math.max(1, count);
  for (let candidate = staggered ? 2 : 1; candidate <= maximum; candidate++) {
    const candidateRows = staggered ? rowCounts(candidate).length : Math.ceil(Math.max(1, count) / candidate);
    const candidateGap = Math.min(12, width / candidate * .06, height / candidateRows * .06);
    const candidateSize = Math.max(0, Math.min(
      (width - candidateGap * (candidate - 1)) / candidate,
      (height - candidateGap * (candidateRows - 1)) / candidateRows,
    ));
    if (candidateSize > size) {
      columns = candidate; rows = candidateRows; size = candidateSize; gap = candidateGap;
    }
  }
  const positions = rowCounts(columns).flatMap((length, row) => Array.from({ length }, (_, index) => ({
    row: row + 1,
    column: (staggered ? columns - length : 0) + index * 2 + 1,
  })));
  return { columns, rows, size, gap, positions };
}
