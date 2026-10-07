// Single-frame inference stays on the device, away from the fluid's render thread.
let models;
async function prepare() {
  const { FilesetResolver, FaceDetector, ImageSegmenter } = await import('./runtime/vision_bundle.mjs');
  const files = await FilesetResolver.forVisionTasks(new URL('./runtime/wasm', self.location).href);
  const face = await FaceDetector.createFromOptions(files, {
    baseOptions: { modelAssetPath: new URL('./face.tflite', self.location).href, delegate: 'CPU' },
    runningMode: 'IMAGE', minDetectionConfidence: .5,
  });
  try {
    const person = await ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: new URL('./selfie.tflite', self.location).href, delegate: 'CPU' },
      runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false,
    });
    return { face, person };
  } catch (error) { face.close(); throw error; }
}
function canvas(width, height) {
  const surface = new OffscreenCanvas(width, height);
  const context = surface.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Prohlížeč nepodporuje zpracování portrétu.');
  return { surface, context };
}
function smooth(value, low, high) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}
async function isolate(frame) {
  const { face, person } = await models;
  const input = canvas(frame.width, frame.height);
  input.context.putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
  const detections = face.detect(input.surface).detections;
  const box = detections.map(d => d.boundingBox).filter(Boolean)
    .sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!box) throw new Error('Obličej nenalezen. Přibližte se a zkuste to znovu.');
  // Keep forehead and chin with more breathing room inside the circular bowl.
  const side = Math.max(box.width * 1.35, box.height * 1.45) / .8;
  const left = box.originX + box.width / 2 - side / 2;
  const top = box.originY + box.height * .42 - side / 2;
  const cropped = canvas(512, 512);
  cropped.context.drawImage(input.surface, left, top, side, side, 0, 0, 512, 512);
  const image = cropped.context.getImageData(0, 0, 512, 512);
  const segmentation = person.segment(cropped.surface);
  try {
    // This pinned Selfie Segmenter has one label/output: foreground confidence.
    const mask = segmentation.confidenceMasks?.[0];
    if (!mask) throw new Error('Izolaci portrétu se nepodařilo získat.');
    const values = mask.getAsFloat32Array(), mw = mask.width, mh = mask.height;
    let foreground = 0;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const mx = Math.max(0, Math.min(mw - 1, (x + .5) * mw / 512 - .5));
      const my = Math.max(0, Math.min(mh - 1, (y + .5) * mh / 512 - .5));
      const x0 = Math.floor(mx), y0 = Math.floor(my), x1 = Math.min(mw - 1, x0 + 1), y1 = Math.min(mh - 1, y0 + 1);
      const dx = mx - x0, dy = my - y0;
      const confidence = (values[y0 * mw + x0] * (1 - dx) + values[y0 * mw + x1] * dx) * (1 - dy)
        + (values[y1 * mw + x0] * (1 - dx) + values[y1 * mw + x1] * dx) * dy;
      const i = (y * 512 + x) * 4;
      image.data[i + 3] = Math.round(image.data[i + 3] * smooth(confidence, .35, .75));
      foreground += image.data[i + 3] / 255;
    }
    if (foreground < 512 * 512 * .1) throw new Error('Portrét není dostatečně vidět. Zkuste to znovu.');
    return { width: 512, height: 512, data: image.data };
  } finally { segmentation.close(); }
}
self.onmessage = async ({ data }) => {
  const { id, frame } = data;
  try {
    models ??= prepare();
    if (!frame) { await models; self.postMessage({ id, ready: true }); return; }
    const image = await isolate(frame);
    self.postMessage({ id, image }, [image.data.buffer]);
  } catch (error) {
    if (!frame) models = undefined;
    self.postMessage({ id, error: error instanceof Error ? error.message : 'Fotografii nelze zpracovat.' });
  }
};
