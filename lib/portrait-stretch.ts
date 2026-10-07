/** Photo Booth-style funhouse stretch, centered on the isolated face.
 * Both axes expand smoothly around the center while the frame edges stay fixed. */
export function stretchPortrait(image: ImageData, enabled: boolean): ImageData {
  if (!enabled) return image;
  const { width, height, data } = image, output = new Uint8ClampedArray(data.length);
  const coordinate = (at: number, length: number) => {
    const p = 2 * at / Math.max(1, length - 1) - 1;
    return (p - .23 * Math.sin(Math.PI * p) + 1) * .5 * (length - 1);
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = coordinate(x, width), sy = coordinate(y, height);
    const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
    const dx = sx - x0, dy = sy - y0;
    const samples = [(y0 * width + x0) * 4, (y0 * width + x1) * 4, (y1 * width + x0) * 4, (y1 * width + x1) * 4];
    const weights = [(1 - dx) * (1 - dy), dx * (1 - dy), (1 - dx) * dy, dx * dy];
    let alpha = 0;
    for (let k = 0; k < 4; k++) alpha += data[samples[k] + 3] * weights[k];
    const i = (y * width + x) * 4; output[i + 3] = Math.round(alpha);
    // Premultiplied sampling keeps transparent surroundings free of color halos.
    for (let channel = 0; channel < 3; channel++) {
      let color = 0;
      for (let k = 0; k < 4; k++) color += data[samples[k] + channel] * data[samples[k] + 3] * weights[k];
      output[i + channel] = alpha ? Math.round(color / alpha) : 0;
    }
  }
  return new ImageData(output, width, height);
}
