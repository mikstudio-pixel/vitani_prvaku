import { countdownFrame } from './intro-parameters';
import { MIXING_FINALE, type ScenarioStage } from './mixing-scenario';

export type SoundRole = 'center' | 'left' | 'right';
export type SoundCue = 'wake' | 'panels' | 'countdown' | 'countdown-start' | 'riser' | 'ding' | 'sleep' | 'failure';
export type SoundFrame = { stage: ScenarioStage; elapsed: number; activity: number; progress: number | null; available: boolean };
export type MixingSound = { volume: number; rate: number };
const mixingStages: ScenarioStage[] = ['analysis', 'mixing', 'keep-mixing', 'stir-prompt', 'not-mixing'];
const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Activity sets energy; actual fluid progress gradually raises the pitch. */
export function mixingSound(frame: SoundFrame): MixingSound {
  const speed = unit(frame.activity), progress = unit(frame.progress ?? 0);
  const mixing = mixingStages.includes(frame.stage) || (frame.stage === 'finishing' && frame.elapsed < MIXING_FINALE.sound);
  const energy = frame.available && mixing ? Math.max(0, (speed - .04) / .96) : 0;
  return { volume: .32 * Math.sqrt(energy), rate: .7 + .65 * speed + .25 * progress };
}

/** Edge-triggered cues, independent of render/telemetry frequency. */
export class SoundSequence {
  private stage: ScenarioStage = 'standby';
  private countdown: number | null = null;
  constructor(private role: SoundRole) {}
  reset() { this.stage = 'standby'; this.countdown = null; }
  step(frame: SoundFrame): SoundCue[] {
    if (frame.stage === 'standby') {
      const sleeping = this.stage === 'restart';
      this.reset(); return sleeping ? ['sleep'] : [];
    }
    if (!frame.available) return [];
    const changed = frame.stage !== this.stage;
    this.stage = frame.stage;
    const cues: SoundCue[] = [];
    if (changed) {
      if (this.role === 'center' && frame.stage === 'detected') cues.push('wake');
      if (this.role !== 'center' && frame.stage === 'panels') cues.push('panels');
      if (this.role === 'center' && frame.stage === 'finishing') cues.push('riser');
      if (this.role === 'center' && frame.stage === 'success') cues.push('ding');
      if (this.role === 'right' && frame.stage === 'failure') cues.push('failure');
    }
    const clock = frame.stage === 'countdown' ? countdownFrame(frame.elapsed) : null;
    const number = clock?.start ? 0 : clock?.number ?? null;
    if (this.role === 'center' && number !== null && number !== this.countdown) cues.push(number === 0 ? 'countdown-start' : 'countdown');
    this.countdown = number;
    return cues;
  }
}
