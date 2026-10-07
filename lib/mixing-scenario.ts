import { countdownDuration, countdownFrame, introValue } from './intro-parameters';
import { panelsDuration } from './intro-animation';
import type { GyroAngles, TrayTelemetry, TiltLight } from './native-host';

// The offline riser is 3.05 seconds at its original playback rate.
export const MIXING_FINALE = { sound: 3.05, pause: .2 } as const;

export const SCENARIO = {
  get liftThreshold() { return introValue('story.liftThreshold'); },
  get liftSeconds() { return introValue('story.liftSeconds'); },
  get mixingThreshold() { return introValue('story.mixingThreshold'); },
  get detected() { return introValue('story.detected'); },
  get panels() { return panelsDuration(); },
  get authorized() { return introValue('story.authorized'); },
  get decision() { return introValue('story.decision'); },
  get startWindow() { return introValue('story.startWindow'); },
  get pauseWindow() { return introValue('story.pauseWindow'); },
  get mixingConfirmation() { return introValue('story.mixingConfirmation'); },
  get secondPrompt() { return introValue('story.secondPrompt'); },
  get successMixed() { return introValue('story.successMixed'); },
  get successHold() { return introValue('story.successHold'); },
  get result() { return introValue('story.result'); },
  get farewell() { return introValue('story.farewell'); },
  restart: 20,
  get retry() { return introValue('story.retry'); },
  get connecting() { return introValue('story.connecting'); },
  get welcome() { return introValue('story.welcome'); },
  get resetQuiet() { return introValue('story.resetQuiet'); },
  get analysis() { return introValue('story.analysis'); },
  get idlePrompt() { return introValue('story.idlePrompt'); },
  get keepMixed() { return introValue('story.keepMixed'); },
  get countdown() { return countdownDuration() + introValue('countdown.start'); },
};

export type ScenarioStage = 'standby' | 'detected' | 'panels' | 'authorized' | 'decision' | 'countdown'
  | 'analysis' | 'mixing' | 'keep-mixing' | 'not-mixing' | 'stir-prompt'
  | 'finishing' | 'success' | 'failure' | 'bon-appetit' | 'hungry' | 'connecting' | 'welcome' | 'restart';
export type MotionSample = { gyro: GyroAngles | null; activity: number; receivedAt: number; quiet?: number; rpm?: number | null; mixed?: number | null; light?: TiltLight | null; simulated?: boolean };
export type MotionInput = { source: 'bluetooth' | 'local' | 'none'; sample: MotionSample | null };

export function selectMotion(remote: (MotionSample & { phase: TrayTelemetry['phase'] }) | null, local: MotionSample | null, now: number): MotionInput {
  // Match the native inbox's three-second heartbeat timeout. A stale host must
  // never freeze the exhibition when the local sensor is still available.
  if (remote && now - remote.receivedAt < 3 && remote.phase !== 'unavailable' && remote.phase !== 'sleeping') return { source: 'bluetooth', sample: remote };
  if (local && now - local.receivedAt < 1) return { source: 'local', sample: local };
  return { source: 'none', sample: null };
}

export type ScenarioSnapshot = {
  stage: ScenarioStage;
  countdown: number;
  countdownStart: boolean;
  remaining: number;
  deadline: 'start' | 'resume' | null;
  progress: number | null;
  mixed: number | null;
};
const finishedStages = ['finishing', 'success', 'failure', 'bon-appetit', 'hungry', 'connecting', 'welcome', 'restart'];

/** Presentation reaches 100% at the success threshold; physics keeps its original value. */
export function visualMixingProgress(mixed: number | null): number | null {
  return mixed === null ? null : Math.max(0, Math.min(1, mixed / SCENARIO.successMixed));
}

/** Representative values for frozen calibration only; never drive a live result. */
export function scenarioPreview(stage: ScenarioStage): ScenarioSnapshot {
  const finished = finishedStages.includes(stage);
  const mixed = stage === 'finishing' || stage === 'success' || stage === 'bon-appetit' ? 1
    : stage === 'mixing' ? 0.3 : stage === 'keep-mixing' ? 0.7 : 0.1;
  const deadline = stage === 'analysis' || stage === 'stir-prompt' || stage === 'not-mixing' ? 'start' : null;
  return {
    stage, countdown: 3, countdownStart: false, mixed, progress: mixed, deadline,
    remaining: stage === 'restart' ? SCENARIO.restart : stage === 'hungry' ? SCENARIO.retry : finished || !deadline ? 0 : stage === 'not-mixing' ? 3.2 : stage === 'stir-prompt' ? 5 : 7,
  };
}

/** Shared story timing; the center simulation owns mixing progress. */
export class MixingScenario {
  private phase: Exclude<ScenarioStage, 'mixing' | 'keep-mixing' | 'not-mixing' | 'stir-prompt'> = 'standby';
  private elapsed = 0;
  private lifted = 0;
  private quiet = 0;
  private startedMixing = false;
  private movingFor = 0;
  private idleSeconds = 0;
  private successFor = 0;
  private mixed: number | null = null;
  private previousTime: number | null = null;

  reset() {
    this.phase = 'standby'; this.elapsed = 0; this.lifted = 0;
    this.quiet = 0; this.startedMixing = false; this.movingFor = 0;
    this.idleSeconds = 0; this.successFor = 0; this.mixed = null;
    this.previousTime = null;
  }

  private enter(phase: typeof this.phase) { this.phase = phase; this.elapsed = 0; }

  // Wake already confirmed the lift. Do not require another gesture after the intro.
  beginAfterWake({ skipIntro = false }: { skipIntro?: boolean } = {}) {
    this.reset();
    this.enter(!skipIntro && SCENARIO.detected > 0 ? 'detected' : !skipIntro && SCENARIO.panels > 0 ? 'panels'
      : SCENARIO.authorized > 0 ? 'authorized' : SCENARIO.decision > 0 ? 'decision' : 'countdown');
  }

  // Late Bluetooth peers join the current intro instead of replaying detection.
  seekIntro(stage: 'detected' | 'panels', elapsed: number) {
    this.reset();
    this.enter(stage);
    this.elapsed = Math.max(0, elapsed);
  }

  step(now: number, sample: MotionSample | null): ScenarioSnapshot {
    const delta = this.previousTime === null ? 0 : Math.max(0, Math.min(0.25, now - this.previousTime));
    this.previousTime = now;
    const finished = finishedStages.includes(this.phase);
    if (!finished) this.mixed = sample?.mixed != null && Number.isFinite(sample.mixed)
      ? Math.max(0, Math.min(1, sample.mixed)) : null;
    // Missing motion pauses the story; missing fluid data can never award success.
    if (!sample || !Number.isFinite(sample.activity)) {
      this.successFor = 0;
      return this.snapshot();
    }
    this.elapsed += delta;
    const moving = sample.activity >= SCENARIO.mixingThreshold;
    this.quiet = sample.quiet != null && Number.isFinite(sample.quiet) ? Math.max(0, sample.quiet)
      : sample.activity > .12 ? 0 : this.quiet + delta;
    switch (this.phase) {
      case 'standby':
        this.lifted = sample.activity >= SCENARIO.liftThreshold ? this.lifted + delta : 0;
        if (sample.activity >= SCENARIO.liftThreshold && this.lifted >= SCENARIO.liftSeconds) this.enter('detected');
        break;
      case 'detected': if (this.elapsed >= SCENARIO.detected) this.enter(SCENARIO.panels > 0 ? 'panels' : SCENARIO.authorized > 0 ? 'authorized' : SCENARIO.decision > 0 ? 'decision' : 'countdown'); break;
      case 'panels': if (this.elapsed >= SCENARIO.panels) this.enter(SCENARIO.authorized > 0 ? 'authorized' : SCENARIO.decision > 0 ? 'decision' : 'countdown'); break;
      case 'authorized': if (this.elapsed >= SCENARIO.authorized) this.enter(SCENARIO.decision > 0 ? 'decision' : 'countdown'); break;
      case 'decision': if (this.elapsed >= SCENARIO.decision) this.enter('countdown'); break;
      case 'countdown': if (this.elapsed >= SCENARIO.countdown) this.enter('analysis'); break;
      case 'analysis':
        this.movingFor = moving ? this.movingFor + delta : 0;
        if (moving && (sample.simulated || this.movingFor >= SCENARIO.mixingConfirmation)) this.startedMixing = true;
        this.idleSeconds = moving ? 0 : this.idleSeconds + delta;
        this.successFor = this.startedMixing && this.mixed !== null && this.mixed >= SCENARIO.successMixed
          ? this.successFor + delta : 0;
        if (this.elapsed >= SCENARIO.analysis && this.startedMixing && this.mixed !== null && this.mixed >= SCENARIO.successMixed && this.successFor >= SCENARIO.successHold) this.enter('finishing');
        else if (!sample.simulated && !this.startedMixing && this.elapsed >= SCENARIO.startWindow) this.enter('failure');
        else if (!sample.simulated && this.startedMixing && this.idleSeconds >= SCENARIO.pauseWindow) this.enter('failure');
        break;
      case 'finishing': if (this.elapsed >= MIXING_FINALE.sound + MIXING_FINALE.pause) this.enter('success'); break;
      case 'success': if (this.elapsed >= SCENARIO.result) this.enter('bon-appetit'); break;
      case 'failure': if (this.elapsed >= SCENARIO.result) this.enter('hungry'); break;
      case 'bon-appetit': if (this.elapsed >= SCENARIO.farewell) this.enter('connecting'); break;
      case 'hungry': if (this.elapsed >= SCENARIO.retry) this.reset(); break;
      case 'connecting':
      case 'welcome': if (this.elapsed >= SCENARIO.connecting && this.quiet >= .75) this.enter('restart'); break;
      case 'restart':
        if (this.quiet < .75) this.enter('connecting');
        else if (this.elapsed >= SCENARIO.restart) this.reset();
        break;
    }
    return this.snapshot();
  }

  get stageElapsed() { return this.elapsed; }

  snapshot(): ScenarioSnapshot {
    let stage: ScenarioStage = this.phase;
    const analyzing = this.phase === 'analysis';
    if (analyzing && this.elapsed >= SCENARIO.analysis) {
      stage = this.startedMixing && this.idleSeconds < SCENARIO.idlePrompt
        ? ((this.mixed ?? 0) >= SCENARIO.keepMixed ? 'keep-mixing' : 'mixing')
        : (this.idleSeconds < SCENARIO.secondPrompt ? 'stir-prompt' : 'not-mixing');
    }
    const deadline = !analyzing ? null : !this.startedMixing ? 'start' : this.idleSeconds >= SCENARIO.idlePrompt ? 'resume' : null;
    return {
      stage, countdown: countdownFrame(this.elapsed).number ?? 0, countdownStart: countdownFrame(this.elapsed).start, deadline,
      remaining: stage === 'restart' ? Math.max(0, SCENARIO.restart - this.elapsed)
        : stage === 'hungry' ? Math.max(0, SCENARIO.retry - this.elapsed) : deadline === 'start' ? Math.max(0, SCENARIO.startWindow - this.elapsed)
        : deadline === 'resume' ? Math.max(0, SCENARIO.pauseWindow - this.idleSeconds) : 0,
      progress: this.mixed, mixed: this.mixed,
    };
  }
}
