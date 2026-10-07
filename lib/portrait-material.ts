import { BOB_SIZE } from './bob-pattern';

/** The same coarse, two-phase mask used by the Bob easter egg.
 * Average camera pixels into blocks, choose an exposure-adaptive threshold,
 * and flip rows for the GPU. No frame or mask is persisted. */
export function portraitPattern(image: Pick<ImageData, 'data' | 'width' | 'height'>, size: number = BOB_SIZE) {
  if (image.width < 1 || image.height < 1 || image.data.length !== image.width * image.height * 4 || !Number.isInteger(size) || size < 1) throw new Error('Fotografie nemá platný obraz.');
  const blocks = new Uint8Array(size * size), histogram = new Uint32Array(256);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const left = Math.floor(x * image.width / size), top = Math.floor(y * image.height / size);
    const right = Math.max(left + 1, Math.floor((x + 1) * image.width / size));
    const bottom = Math.max(top + 1, Math.floor((y + 1) * image.height / size));
    let sum = 0, count = 0;
    for (let sy = top; sy < bottom; sy++) for (let sx = left; sx < right; sx++) {
      const i = (sy * image.width + sx) * 4;
      sum += .2126 * image.data[i] + .7152 * image.data[i + 1] + .0722 * image.data[i + 2]; count++;
    }
    const light = Math.round(sum / count); blocks[y * size + x] = light; histogram[light]++;
  }
  // Otsu's threshold preserves facial contrast under different lighting.
  let total = 0;
  for (let i = 0; i < 256; i++) total += i * histogram[i];
  let weight = 0, sum = 0, best = -1, threshold = 127;
  for (let i = 0; i < 255; i++) {
    weight += histogram[i]; sum += i * histogram[i];
    const other = blocks.length - weight;
    if (!weight || !other) continue;
    const difference = sum / weight - (total - sum) / other;
    const variance = weight * other * difference * difference;
    if (variance > best) { best = variance; threshold = i; }
  }
  const values = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) values[(size - 1 - y) * size + x] = blocks[y * size + x] <= threshold ? 1 : 0;
  return values;
}
