export const PORTRAIT_SIZE = 128;

/** Foreground-only contrast, five monochrome tones and upright GPU rows.
 * Transparent surroundings become a uniform field, never camera scenery. */
export function portraitPattern(image: Pick<ImageData, 'data' | 'width' | 'height'>, size = PORTRAIT_SIZE) {
  if (image.width < 1 || image.height < 1 || image.data.length !== image.width * image.height * 4 || !Number.isInteger(size) || size < 1) throw new Error('Fotografie nemá platný obraz.');
  const blocks = new Float32Array(size * size), opacity = new Float32Array(size * size), histogram = new Uint32Array(256);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const left = Math.floor(x * image.width / size), top = Math.floor(y * image.height / size);
    const right = Math.max(left + 1, Math.floor((x + 1) * image.width / size));
    const bottom = Math.max(top + 1, Math.floor((y + 1) * image.height / size));
    let sum = 0, weight = 0, count = 0;
    for (let sy = top; sy < bottom; sy++) for (let sx = left; sx < right; sx++) {
      const i = (sy * image.width + sx) * 4, alpha = image.data[i + 3] / 255;
      sum += (.2126 * image.data[i] + .7152 * image.data[i + 1] + .0722 * image.data[i + 2]) * alpha;
      weight += alpha; count++;
    }
    const i = y * size + x;
    blocks[i] = weight ? sum / weight : 0; opacity[i] = weight / count;
    if (opacity[i] > .5) histogram[Math.round(blocks[i])]++;
  }
  const total = histogram.reduce((sum, count) => sum + count, 0);
  const percentile = (fraction: number) => {
    let count = 0;
    for (let i = 0; i < 256; i++) { count += histogram[i]; if (count > total * fraction) return i; }
    return 255;
  };
  const low = percentile(.08), high = Math.max(low + 1, percentile(.92));
  const values = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    let light = blocks[i];
    // Modest local contrast keeps eyes and mouth visible without dithering grain.
    if (opacity[i] > .9) {
      let sum = 0, count = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < size && ny >= 0 && ny < size && opacity[ny * size + nx] > .9) { sum += blocks[ny * size + nx]; count++; }
      }
      if (count) light += .4 * (light - sum / count);
    }
    const ink = Math.round(4 * (1 - Math.max(0, Math.min(1, (light - low) / (high - low))))) / 4;
    values[(size - 1 - y) * size + x] = .85 * (1 - opacity[i]) + ink * opacity[i];
  }
  return values;
}
