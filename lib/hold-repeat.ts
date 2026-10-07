// One immediate step, then a steady repeat until release/cancellation.
export class HoldRepeat {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private active = false;

  constructor(private readonly step: () => void) {}

  start() {
    this.stop();
    this.active = true;
    this.step();
    if (this.active) this.timer = setTimeout(this.repeat, 350);
  }

  stop() {
    this.active = false;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private repeat = () => {
    if (!this.active) return;
    this.step();
    if (this.active) this.timer = setTimeout(this.repeat, 70);
  };
}
