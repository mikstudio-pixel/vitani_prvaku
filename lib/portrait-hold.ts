export const PORTRAIT_HOLD_MS = 1000;

/** One capture per continuous, single-pointer hold. No timer survives release. */
export class PortraitHold {
  private contacts = new Set<number>();
  private hold: { id: number; at: number; x: number; y: number; captured: boolean } | null = null;
  down(id: number, now: number, x = 0, y = 0) {
    this.contacts.add(id);
    if (this.contacts.size !== 1) { this.hold = null; return; }
    this.hold = { id, at: now, x, y, captured: false };
  }
  move(id: number, x: number, y: number) {
    if (this.hold?.id === id && Math.hypot(x - this.hold.x, y - this.hold.y) > 24) this.hold = null;
  }
  up(id: number) {
    this.contacts.delete(id);
    if (this.hold?.id === id) this.hold = null;
  }
  cancel() { this.contacts.clear(); this.hold = null; }
  get active() { return this.hold !== null && !this.hold.captured; }
  step(now: number): { progress: number; capture: boolean } {
    if (!this.hold || this.hold.captured) return { progress: 0, capture: false };
    const progress = Math.max(0, Math.min(1, (now - this.hold.at) / PORTRAIT_HOLD_MS));
    if (progress === 1) this.hold.captured = true;
    return { progress, capture: progress === 1 };
  }
}
