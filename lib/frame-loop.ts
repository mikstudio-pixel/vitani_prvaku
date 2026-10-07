import { DEFAULT_FRAME_RATE, validFrameRate, type FrameRate } from './frame-rate';

// Owns the scheduled callback so a sleeping renderer does not wake every frame.
export class FrameLoop {
  private frame: number | null = null;
  private lastTime: number | null = null;
  private nextTime = 0;
  private enabled = false;

  constructor(
    private advance: (seconds: number) => void,
    private fps = DEFAULT_FRAME_RATE as number,
    private request: (callback: FrameRequestCallback) => number = callback => requestAnimationFrame(callback),
    private cancel: (id: number) => void = id => cancelAnimationFrame(id),
  ) {}

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.lastTime = null;
    if (this.frame !== null) this.cancel(this.frame);
    this.frame = enabled ? this.request(this.tick) : null;
  }

  get running() { return this.enabled; }

  setFrameRate(fps: FrameRate) {
    if (!validFrameRate(fps) || this.fps === fps) return;
    this.fps = fps;
    if (this.lastTime !== null) this.nextTime = this.lastTime + 1000 / fps;
  }

  private tick = (time: number) => {
    this.frame = null;
    if (!this.enabled) return;
    const interval = 1000 / this.fps;
    if (this.lastTime === null) {
      this.lastTime = time; this.nextTime = time + interval;
    } else if (time >= this.nextTime - 0.5) {
      const seconds = (time - this.lastTime) / 1000;
      this.lastTime = time;
      // Keep the cadence anchored: resetting the deadline to each slightly
      // late callback slowly loses frames. Skip missed slots without bursts.
      this.nextTime += interval * Math.max(1, Math.floor((time + 0.5 - this.nextTime) / interval) + 1);
      this.advance(Math.min(seconds, 1 / 30));
    }
    if (this.enabled) this.frame = this.request(this.tick);
  };
}
