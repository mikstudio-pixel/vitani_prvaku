import type { MotionInput, MotionSample } from './mixing-scenario';

export const angleDifference = (a: number, b: number) => ((a - b + 540) % 360) - 180;

/** Angular travel per minute, expressed in equivalent revolutions (not spoon turns). */
export class MotionSpeed {
  private previous: MotionSample | null = null;
  private source = '';
  private rpm: number | null = null;

  sample(sample: MotionSample | null, source: MotionInput['source'] | 'demo'): MotionSample | null {
    if (!sample?.gyro || !Object.values(sample.gyro).every(Number.isFinite)) {
      this.previous = null;
      this.rpm = null;
      return sample ? { ...sample, rpm: null } : null;
    }
    const previous = this.source === source ? this.previous : null;
    const dt = previous ? sample.receivedAt - previous.receivedAt : 0;
    if (previous?.gyro && dt > 0 && dt < 1) {
      const degrees = Math.hypot(...(['x', 'y', 'z'] as const).map(axis => angleDifference(sample.gyro![axis], previous.gyro![axis])));
      const rpm = degrees / dt / 6;
      this.rpm = this.rpm === null ? rpm : this.rpm + (rpm - this.rpm) * (1 - Math.exp(-dt / 0.3));
    } else if (!previous || dt !== 0) {
      this.rpm = null;
    }
    this.previous = sample;
    this.source = source;
    return { ...sample, rpm: this.rpm };
  }
}
