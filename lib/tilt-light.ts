import { countdownDuration, countdownFrame, introCurve, introValue } from './intro-parameters';
import { SCENARIO, type ScenarioStage } from './mixing-scenario';
import type { TiltLight } from './native-host';
import type { Tilt } from './tilt';
import { type WakeFrame } from './wake-intro';
import { INTRO, blinkDuration, curveProgress } from './intro-animation';

const turn = Math.PI * 2;
export const wrapLightAngle = (angle: number) => ((angle % turn) + turn) % turn;
export function lightFromTilt(tilt: Tilt): TiltLight {
  return { direction: wrapLightAngle(Math.atan2(tilt.x, -tilt.y)), strength: Math.min(1, Math.hypot(tilt.x, tilt.y)) };
}

/** Smooth between sensor/BLE samples, including the 359° → 0° boundary. */
export class TiltLightMotion {
  private current = { direction: 0, strength: 0 };
  private target = { direction: 0, strength: 0 };
  receive(value: TiltLight | null) {
    if (!value || !Number.isFinite(value.direction) || !Number.isFinite(value.strength)) {
      this.target = { ...this.current, strength: 0 }; return;
    }
    this.target = { direction: value.strength > 0.001 ? value.direction : this.current.direction, strength: Math.max(0, Math.min(1, value.strength)) };
  }
  advance(seconds: number): TiltLight {
    const amount = 1 - Math.exp(-Math.max(0, seconds) / 0.055);
    const delta = Math.atan2(Math.sin(this.target.direction - this.current.direction), Math.cos(this.target.direction - this.current.direction));
    this.current = this.settled ? { direction: this.target.direction + Math.round((this.current.direction - this.target.direction) / turn) * turn, strength: this.target.strength } : {
      direction: this.current.direction + delta * amount,
      strength: this.current.strength + (this.target.strength - this.current.strength) * amount,
    };
    return this.current;
  }
  get settled() {
    const difference = this.target.direction - this.current.direction;
    return Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference))) < 0.0001 && Math.abs(this.target.strength - this.current.strength) < 0.0001;
  }
}

export const LED_COUNT = 24;
export const LED_PITCH = turn / LED_COUNT;
export const restingLightSpan = LED_PITCH * 0.91;

/** Virtual sweep used only to calculate whole-LED brightness, never drawn. */
export function ringLights(frame: WakeFrame, signal: TiltLight, story?: { stage: ScenarioStage; elapsed: number }, finaleDirection = 1) {
  const steady = { angle: signal.direction, span: LED_PITCH, light: Math.pow(signal.strength, 0.3), peak: Math.pow(signal.strength, 0.85), phase: 'tracking' };
  if (frame.stage === 'waiting') return { ...steady, light: 0, peak: 0, phase: 'waiting' };
  const full = { angle: Math.PI, span: turn, light: introValue('ring.fullLight'), peak: introValue('ring.fullPeak'), phase: 'full' };
  if ((!story && frame.stage !== 'complete') || (story && ['detected', 'panels', 'authorized', 'decision'].includes(story.stage))) return full;
  if (story?.stage === 'standby') return { ...steady, light: 0, peak: 0, phase: 'waiting' };
  if (story?.stage === 'finishing') return {
    angle: wrapLightAngle(story.elapsed * turn * 2.5 * finaleDirection), span: LED_PITCH * 5,
    light: full.light, peak: full.peak, phase: 'finishing',
  };
  if (!story || !['countdown', 'analysis'].includes(story.stage)) return steady;
  if (story.stage === 'countdown' && story.elapsed < countdownDuration()) {
    // Each numeral starts fully lit. Extinguish clockwise from the top,
    // completing one revolution before the next numeral restores the ring.
    const countdown = countdownFrame(story.elapsed);
    if (!countdown.number) return { ...full, light: 0, peak: 0, phase: 'countdown-gap' };
    const p = curveProgress(countdown.progress, introCurve('ring.sweep'));
    return { ...full, angle: Math.PI * (1 + p), span: turn * (1 - p), phase: 'countdown' };
  }
  const { blink, collapse } = INTRO.ring;
  let elapsed = story.stage === 'countdown' ? story.elapsed - countdownDuration() : SCENARIO.countdown - countdownDuration() + story.elapsed;
  if (elapsed < blink.count * blinkDuration()) {
    const t = elapsed % blinkDuration();
    const blinkEase = (p: number) => curveProgress(p, introCurve('ring.blink'));
    const brightness = t < blink.fadeOut ? 1 - blinkEase(t / blink.fadeOut)
      : t < blink.fadeOut + blink.dark ? 0
      : t < blink.fadeOut + blink.dark + blink.fadeIn ? blinkEase((t - blink.fadeOut - blink.dark) / blink.fadeIn) : 1;
    return { ...full, light: full.light * brightness, peak: full.peak * brightness, phase: 'blink' };
  }
  elapsed -= blink.count * blinkDuration();
  if (elapsed >= collapse.duration) return steady;
  const p = curveProgress(elapsed / collapse.duration, collapse.curve);
  // Reuse the existing collapse towards the current gyro heading.
  return { ...steady, span: turn + (steady.span - turn) * p,
    light: full.light + (steady.light - full.light) * p,
    peak: full.peak + (steady.peak - full.peak) * p, phase: 'collapse' };
}

/** Average the sweep over each LED cell; a physical segment has one brightness. */
export function ringSegmentLevels(sweep: ReturnType<typeof ringLights>) {
  const half = Math.max(0, Math.min(turn, sweep.span)) / 2;
  return Array.from({ length: LED_COUNT }, (_, index) => {
    const offset = index * LED_PITCH - sweep.angle;
    const center = Math.atan2(Math.sin(offset), Math.cos(offset));
    let coverage = 0;
    // Include the wrapped part of the cell across the opposite side of the ring.
    for (const shift of [-turn, 0, turn]) {
      const position = center + shift;
      coverage += Math.max(0, Math.min(position + LED_PITCH / 2, half) - Math.max(position - LED_PITCH / 2, -half));
    }
    const level = Math.max(0, Math.min(1, coverage / LED_PITCH));
    return { light: sweep.light * level, peak: sweep.peak * level };
  });
}
