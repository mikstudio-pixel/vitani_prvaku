import type { TrayPhase } from './native-host';
import { panelsDuration } from './intro-animation';
import { introValue } from './intro-parameters';
import type { ScenarioStage } from './mixing-scenario';

// Wake only the center first; the introducing phase then lights both sides.
export const WAKE = { get orbit() { return introValue('story.detected'); }, get panels() { return panelsDuration(); } } as const;
export type WakeStage = 'waiting' | 'orbit' | 'panels' | 'complete';
export type WakeFrame = { stage: WakeStage; progress: number; elapsed: number };
export function storyWakeFrame(stage: ScenarioStage, elapsed: number): WakeFrame {
  if (stage === 'standby') return { stage: 'waiting', progress: 0, elapsed: 0 };
  if (stage === 'detected' || stage === 'panels') {
    const wakeStage = stage === 'detected' ? 'orbit' : 'panels';
    return { stage: wakeStage, progress: Math.min(1, elapsed / (WAKE[wakeStage] || 1)), elapsed };
  }
  return { stage: 'complete', progress: 1, elapsed: 0 };
}
export const ease = (value: number) => {
  const p = Math.max(0, Math.min(1, value));
  return p * p * (3 - 2 * p);
};

/** The host owns one clock, restarted for each new portion after sleep. */
export class WakeIntro {
  private started: number | null = null;
  sleep() { this.started = null; }
  start(now: number) { this.started = now; }
  frame(now: number): WakeFrame {
    if (this.started === null) return { stage: 'waiting', progress: 0, elapsed: 0 };
    const elapsed = Math.max(0, now - this.started);
    if (elapsed < WAKE.orbit) return { stage: 'orbit', progress: elapsed / WAKE.orbit, elapsed };
    if (elapsed < WAKE.orbit + WAKE.panels) return { stage: 'panels', progress: (elapsed - WAKE.orbit) / WAKE.panels, elapsed: elapsed - WAKE.orbit };
    return { stage: 'complete', progress: 1, elapsed: 0 };
  }
}

/** Seek from the host's phase time; late packets must not replay the intro. */
export class SideWakeIntro {
  private current: WakeFrame;
  private receivedAt = 0;
  private completed = false;
  constructor(waiting = true) { this.current = { stage: waiting ? 'waiting' : 'complete', progress: waiting ? 0 : 1, elapsed: 0 }; }
  sleep() { this.current = { stage: 'waiting', progress: 0, elapsed: 0 }; this.completed = false; }
  useLocalFallback() {
    // Preserve standalone side-display operation; an interrupted host intro
    // still waits for the host instead of advancing on the local sensor.
    if (this.current.stage === 'waiting') this.current = { stage: 'complete', progress: 1, elapsed: 0 };
  }
  receive(phase: TrayPhase, elapsed: number, now: number) {
    if (phase === 'sleeping') { this.sleep(); return; }
    if (phase === 'unavailable') return;
    if (phase === 'waking' || phase === 'introducing') {
      this.current = { stage: phase === 'waking' ? 'orbit' : 'panels', progress: 0, elapsed };
      this.receivedAt = now;
      this.completed = false;
    } else {
      this.completed ||= this.current.stage !== 'complete';
      this.current = { stage: 'complete', progress: 1, elapsed: 0 };
    }
  }
  takeCompletion() { const completed = this.completed; this.completed = false; return completed; }
  frame(now: number): WakeFrame {
    const frame = this.current;
    if (frame.stage !== 'orbit' && frame.stage !== 'panels') return frame;
    // Smooth between BLE updates, but stop on a lost connection.
    const elapsed = frame.elapsed + Math.max(0, Math.min(0.2, now - this.receivedAt));
    return { ...frame, elapsed, progress: Math.min(1, elapsed / WAKE[frame.stage]) };
  }
}
