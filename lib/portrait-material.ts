/** Convert a square camera frame to the liquid's dark concentration field.
 * Rows are flipped for WebGL. Exposure starts at zero; no photo is retained. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export function portraitMaterial(image: Pick<ImageData, 'data' | 'width' | 'height'>, size: number) {
  if (image.width < 1 || image.height < 1 || image.data.length !== image.width * image.height * 4) throw new Error('Fotografie nemá platný obraz.');
  const result = new Float32Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sourceX = Math.min(image.width - 1, Math.floor((x + .5) * image.width / size));
    const sourceY = Math.min(image.height - 1, Math.floor((y + .5) * image.height / size));
    const source = (sourceY * image.width + sourceX) * 4;
    const luminance = (.2126 * image.data[source] + .7152 * image.data[source + 1] + .0722 * image.data[source + 2]) / 255;
    const target = ((size - 1 - y) * size + x) * 4;
    // Slight contrast keeps facial features legible in the liquid's soft light.
    const dark = 1 - Math.max(0, Math.min(1, (luminance - .5) * 1.25 + .5));
    // Halftone uses truly separate light/dark material. Continuous gray would
    // be measured as already mixed before the visitor touched the iPad.
    result[target] = dark > (BAYER[(y % 4) * 4 + x % 4] + .5) / 16 ? 1 : 0;
    result[target + 3] = 1;
  }
  return result;
}
