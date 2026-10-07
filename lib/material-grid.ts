// Ceil at every level: a 384 grid ends in 6 → 3 → 2 → 1. Reduction
// shaders treat missing taps as zero, preserving sums and their ratios.
export function reductionSizes(size: number): number[] {
  const sizes: number[] = [];
  while (size > 1) {
    size = Math.ceil(size / 2);
    sizes.push(size);
  }
  return sizes;
}
