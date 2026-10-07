export type CameraState = { phase: 'off' | 'preparing' | 'ready' | 'error'; message: string };
export const CAMERA_OFF: CameraState = { phase: 'off', message: 'Připravte kameru před příchodem návštěvníků.' };

/** Video stays on this device. Capture returns one in-memory frame, never a URL. */
export class PortraitCamera {
  private stream: MediaStream | null = null;
  private pending: Promise<void> | null = null;
  private generation = 0;
  private state: CameraState = CAMERA_OFF;
  constructor(private video: HTMLVideoElement, private onState: (state: CameraState) => void) {
    video.muted = true; video.playsInline = true;
  }
  private publish(state: CameraState) { this.state = state; this.onState(state); }
  prepare(): Promise<void> {
    if (this.state.phase === 'ready') return Promise.resolve();
    if (this.pending) return this.pending;
    const generation = ++this.generation;
    this.publish({ phase: 'preparing', message: 'Povolte kameru v prohlížeči. Připravuji obraz…' });
    const pending = this.open(generation).finally(() => { if (this.pending === pending) this.pending = null; });
    this.pending = pending;
    return pending;
  }
  private async open(generation: number) {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera vyžaduje HTTPS a podporovaný prohlížeč.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 1280 } } });
      if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('Kamera neposkytuje obraz.');
      const facing = track.getSettings().facingMode;
      if (facing && facing !== 'user') throw new Error('Přední kamera není dostupná. Zkontrolujte zařízení.');
      track.addEventListener('ended', () => {
        if (generation === this.generation) this.fail('Kamera byla přerušena. Připravte ji znovu.');
      }, { once: true });
      this.video.srcObject = stream;
      await this.video.play();
      const deadline = performance.now() + 8000;
      while (generation === this.generation && !this.frameReady()) {
        if (performance.now() >= deadline) throw new Error('Kamera zatím nemá obraz. Připravte ji znovu.');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      if (generation === this.generation) this.publish({ phase: 'ready', message: 'Kamera je připravená. Fotografie se neukládají ani neodesílají.' });
    } catch (error) {
      if (generation !== this.generation) return;
      const message = error instanceof Error && error.name === 'NotAllowedError'
        ? 'Kamera není povolená. Povolte ji pro tento web v Safari a zkuste to znovu.'
        : error instanceof Error ? error.message : 'Kameru se nepodařilo připravit.';
      this.fail(message);
    }
  }
  private frameReady() {
    const track = this.stream?.getVideoTracks()[0];
    return this.video.readyState >= 2 && this.video.videoWidth > 0 && this.video.videoHeight > 0 && track?.readyState === 'live' && track.enabled && !track.muted;
  }
  capture(size = 768): ImageData {
    if (this.state.phase !== 'ready' || !this.frameReady()) throw new Error('Kamera není připravená. Zkuste ji znovu připravit.');
    const width = this.video.videoWidth, height = this.video.videoHeight;
    const scale = size / Math.max(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Fotografii nelze zpracovat.');
    // Keep the complete frame for face detection, with upright selfie mirroring.
    context.translate(canvas.width, 0); context.scale(-1, 1);
    context.drawImage(this.video, 0, 0, width, height, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  }
  private fail(message: string) { this.stop(); this.publish({ phase: 'error', message }); }
  stop() {
    ++this.generation; this.pending = null;
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    this.video.pause(); this.video.srcObject = null;
    this.publish(CAMERA_OFF);
  }
}
