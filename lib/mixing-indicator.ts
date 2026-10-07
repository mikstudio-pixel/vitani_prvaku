import { countdownDuration, countdownFrame } from './intro-parameters';
import { MixingScenario, SCENARIO } from './mixing-scenario';
import type { TrayTelemetry } from './native-host';
import type { WakeFrame } from './wake-intro';

export type MixingIndicatorFrame = { phase: 'ready' | 'mixing' | 'success'; progress: number; prompt?: 'detected' | 'ready' | '3' | '2' | '1' | 'start' | 'done' };
export const INDICATOR_READY: MixingIndicatorFrame = { phase: 'ready', progress: 0 };

/** Uses the same success rules and wake clock as the side-display story. */
export class MixingIndicator {
  private scenario = new MixingScenario();
  private started = false;
  private previousElapsed = 0;
  private progress = 0;
  private succeeded = false;
  private followingIntro = false;

  get storyFrame() {
    const { stage, remaining, deadline } = this.scenario.snapshot();
    return { stage, elapsed: this.scenario.stageElapsed, remaining, deadline };
  }
  get qrReady() { return this.succeeded && this.scenario.snapshot().stage !== 'success'; }
  get physicsPaused() {
    const { stage, elapsed } = this.storyFrame;
    return ['standby', 'detected', 'panels', 'authorized', 'decision', 'success'].includes(stage) || (stage === 'countdown' && elapsed < countdownDuration());
  }

  reset({ waitForLift = false }: { waitForLift?: boolean } = {}) {
    this.scenario.reset(); this.started = waitForLift; this.previousElapsed = 0;
    this.progress = 0; this.succeeded = false; this.followingIntro = false;
  }

  step(now: number, state: TrayTelemetry | null, intro: boolean | WakeFrame = false): MixingIndicatorFrame {
    if (intro === true || (typeof intro === 'object' && intro.stage === 'waiting') || state?.phase === 'sleeping') { this.reset(); return INDICATOR_READY; }
    if (state && state.elapsed < this.previousElapsed) this.reset(); // A fresh portion, including manual reset.
    if (typeof intro === 'object') {
      if (intro.stage === 'orbit' || intro.stage === 'panels') {
        this.scenario.seekIntro(intro.stage === 'orbit' ? 'detected' : 'panels', intro.elapsed);
        this.started = true; this.followingIntro = true;
      } else if (this.followingIntro) {
        this.scenario.beginAfterWake({ skipIntro: true }); this.followingIntro = false;
      }
    }
    if (!this.started && state) { this.scenario.beginAfterWake(); this.started = true; }
    if (state) this.previousElapsed = state.elapsed;
    const sample = state && state.phase !== 'unavailable'
      ? { gyro: state.gyro ?? null, activity: state.activity, mixed: state.mixed, simulated: state.simulated, quiet: state.quiet, receivedAt: now } : null;
    const scenario = this.scenario.step(now, sample);
    if (scenario.stage === 'standby') {
      this.succeeded = false; this.progress = 0;
      return INDICATOR_READY;
    }
    if (scenario.stage === 'success') { this.succeeded = true; this.progress = 1; }
    if (!this.physicsPaused && sample && sample.activity >= SCENARIO.mixingThreshold && sample.mixed != null && Number.isFinite(sample.mixed)) {
      this.progress = Math.max(this.progress, Math.min(1, Math.max(0, sample.mixed) / SCENARIO.successMixed));
    }
    const countdown = countdownFrame(this.scenario.stageElapsed);
    const prompt = scenario.stage === 'detected' || scenario.stage === 'panels' ? 'detected' : scenario.stage === 'authorized' || scenario.stage === 'decision' ? 'ready'
      : scenario.stage === 'countdown' ? (countdown.start ? 'start' : countdown.number ? String(countdown.number) as '3' | '2' | '1' : undefined)
      : scenario.stage === 'analysis' ? 'start' : scenario.stage === 'success' ? 'done' : undefined;
    return { phase: this.succeeded ? 'success' : this.progress > 0 ? 'mixing' : 'ready', progress: this.progress, ...(prompt ? { prompt } : {}) };
  }
}

export function mixingIndicatorColor(frame: MixingIndicatorFrame) {
  if (frame.phase === 'success') return '#7DDE07';
  return frame.phase === 'ready' ? '#FFFFFF' : '#1279FF';
}
