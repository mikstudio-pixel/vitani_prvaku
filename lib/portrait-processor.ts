import { APP_VERSION } from './app-version';

/** One reusable worker; no image URLs, storage or network uploads. */
export class PortraitProcessor {
  private worker: Worker | null = null;
  private sequence = 0;
  private requests = new Map<number, { resolve: (image: ImageData | null) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private request(image?: ImageData): Promise<ImageData | null> {
    if (!this.worker) {
      this.worker = new Worker(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/portrait/portrait-worker.js?v=${APP_VERSION}`);
      this.worker.onmessage = ({ data }) => {
        const request = this.requests.get(data.id);
        if (!request) return;
        clearTimeout(request.timer); this.requests.delete(data.id);
        if (data.error) request.reject(new Error(data.error));
        else request.resolve(data.image ? new ImageData(data.image.data, data.image.width, data.image.height) : null);
      };
      this.worker.onerror = () => this.dispose('Zpracování portrétu selhalo. Obnovte stránku.');
    }
    const worker = this.worker, id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.dispose('Zpracování portrétu trvalo příliš dlouho. Zkuste to znovu.'), 30000);
      this.requests.set(id, { resolve, reject, timer });
      // Keep the caller's original frame intact when transferring pixels to the worker.
      const frame = image ? { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) } : undefined;
      worker.postMessage({ id, frame }, frame ? [frame.data.buffer] : []);
    });
  }
  warmup() { return this.request(); }
  async process(image: ImageData): Promise<ImageData> {
    const result = await this.request(image);
    if (!result) throw new Error('Izolace portrétu nevrátila obraz.');
    return result;
  }
  dispose(message = 'Zpracování portrétu bylo zrušeno.') {
    this.worker?.terminate(); this.worker = null;
    for (const request of this.requests.values()) { clearTimeout(request.timer); request.reject(new Error(message)); }
    this.requests.clear();
  }
}
