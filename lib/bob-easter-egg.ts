import type { Tilt } from './tilt';

export const BOB_TIMING = { reveal: 3, hold: 3, dissolve: 2 } as const;
export const BOB_SECONDS = BOB_TIMING.reveal + BOB_TIMING.hold + BOB_TIMING.dissolve;
const SWING = 0.32; // About 6° of travel; a comfortable ~3° tilt to each side.

/** Recognize deliberate left/right rocking, independently of mixing activity. */
export class BobGesture {
  private previousTime: number | null = null;
  private startedAt: number | null = null;
  private lastTurnAt = 0;
  private direction = 0;
  private extremeX = 0;
  private turns = 0;
  private minX = Infinity;
  private maxX = -Infinity;
  private minY = Infinity;
  private maxY = -Infinity;
  private cooldownUntil = 0;

  private clearGesture() {
    this.startedAt = null; this.direction = 0; this.turns = 0;
    this.minX = Infinity; this.maxX = -Infinity;
    this.minY = Infinity; this.maxY = -Infinity;
  }

  reset() {
    this.clearGesture(); this.previousTime = null; this.cooldownUntil = 0;
  }

  step(now: number, tilt: Tilt): boolean {
    if (![now, tilt.x, tilt.y].every(Number.isFinite)) { this.clearGesture(); this.previousTime = null; return false; }
    if (this.previousTime !== null && (now <= this.previousTime || now - this.previousTime > 0.25)) this.clearGesture();
    this.previousTime = now;
    if (now < this.cooldownUntil) { this.clearGesture(); return false; }
    if (this.startedAt !== null && now - this.lastTurnAt > 2.2) this.clearGesture();
    this.minX = Math.min(this.minX, tilt.x); this.maxX = Math.max(this.maxX, tilt.x);
    this.minY = Math.min(this.minY, tilt.y); this.maxY = Math.max(this.maxY, tilt.y);
    // Compare movement, not the resting angle of a tray held in someone's hands.
    // Allow a little wobble, but keep circular and diagonal stirring separate.
    if (this.maxY - this.minY > Math.max(0.16, (this.maxX - this.minX) * 0.45)) {
      this.clearGesture(); return false;
    }
    if (this.startedAt === null) {
      if (this.maxX - this.minX < SWING) return false;
      this.startedAt = now; this.lastTurnAt = now;
      this.direction = tilt.x - this.minX >= SWING ? 1 : -1;
      this.extremeX = tilt.x;
      return false;
    }
    if (this.direction * (tilt.x - this.extremeX) > 0) this.extremeX = tilt.x;
    if (this.direction * (this.extremeX - tilt.x) >= SWING) {
      this.direction *= -1; this.extremeX = tilt.x;
      this.lastTurnAt = now; this.turns++;
    }
    if (now - this.startedAt < 3 || this.turns < 3) return false;
    this.cooldownUntil = now + BOB_SECONDS + 3;
    this.clearGesture();
    return true;
  }
}
