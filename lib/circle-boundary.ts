// Fractional face apertures and cell areas for a fixed circular finite-volume
// domain. Shared faces are stored once (east/north), so fluxes cancel exactly.
export function circleBoundary(size: number, radius: number) {
  const data = new Float32Array(size * size * 4), h = 1 / size;
  const span = (fixed: number, low: number, high: number) => {
    const extent = Math.sqrt(Math.max(0, radius * radius - fixed * fixed));
    return Math.max(0, Math.min(high, extent) - Math.max(low, -extent));
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const left = x * h - .5, bottom = y * h - .5, i = (y * size + x) * 4;
    data[i] = span(left + h, bottom, bottom + h) / h;
    data[i + 1] = span(bottom + h, left, left + h) / h;
    // Only cut cells need quadrature; 32 strips give a stable sub-cell area.
    const center = Math.hypot(left + h / 2, bottom + h / 2);
    if (center < radius - h * Math.SQRT1_2) data[i + 2] = 1;
    else if (center < radius + h * Math.SQRT1_2) {
      for (let k = 0; k < 32; k++) data[i + 2] += span(left + h * (k + .5) / 32, bottom, bottom + h) / (32 * h);
    }
    data[i + 3] = center - radius;
  }
  return data;
}

// Each tiny cut cell belongs to a face-adjacent cell with area >= 1/2.
// Groups are disjoint (no chains); volume-weighted offsets in cell units let the GPU
// redistribute a conservative update without flattening a linear surface.
export function circleMergeGroups(size: number, geometry: Float32Array) {
  const count = size * size, parents = new Int32Array(count);
  const area = (i: number) => geometry[i * 4 + 2];
  const totals = new Float64Array(count * 3);
  for (let i = 0; i < count; i++) {
    let parent = i;
    if (area(i) > .00001 && area(i) < .5) {
      for (const j of [i - 1, i + 1, i - size, i + size]) {
        if (j >= 0 && j < count && area(j) > area(parent)) parent = j;
      }
      if (area(parent) < .5) throw new Error('Circular cut cell has no stable neighbor.');
    }
    parents[i] = parent;
    if (area(i) <= .00001) continue;
    totals[parent * 3] += area(i);
    totals[parent * 3 + 1] += area(i) * (i % size - parent % size);
    totals[parent * 3 + 2] += area(i) * (Math.floor(i / size) - Math.floor(parent / size));
  }
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const parent = parents[i], weight = totals[parent * 3];
    data[i * 4] = parent;
    data[i * 4 + 1] = weight;
    if (weight > 0) {
      data[i * 4 + 2] = totals[parent * 3 + 1] / weight;
      data[i * 4 + 3] = totals[parent * 3 + 2] / weight;
    }
  }
  return data;
}
