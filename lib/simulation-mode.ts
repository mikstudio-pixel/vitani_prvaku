import { SCENARIO, type ScenarioStage } from './mixing-scenario';
import type { TrayTelemetry } from './native-host';

export type SimulationSettings = { enabled: boolean; wakesPerHour: number };
export const DEFAULT_SIMULATION: SimulationSettings = { enabled: false, wakesPerHour: 6 };
export const SIMULATION_MIX_SECONDS = 6;
export function validSimulationSettings(value: unknown): value is SimulationSettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as SimulationSettings;
  return typeof settings.enabled === 'boolean' && Number.isInteger(settings.wakesPerHour)
    && settings.wakesPerHour >= 1 && settings.wakesPerHour <= 60;
}

/** Synthetic input is confined to an explicitly started exhibition demonstration. */
export class SimulationRun {
  private mixingStarted: number | null = null;
  private finished = false;
  private reported = false;
  sample(now: number, stage: ScenarioStage): Partial<TrayTelemetry> & { tiltX: number; tiltY: number } {
    if (['analysis', 'mixing', 'keep-mixing', 'stir-prompt', 'not-mixing'].includes(stage)) this.mixingStarted ??= now;
    if (stage === 'restart') this.finished = true;
    const elapsed = this.mixingStarted === null ? 0 : Math.max(0, now - this.mixingStarted);
    const moving = this.mixingStarted !== null && elapsed < SIMULATION_MIX_SECONDS && !this.finished;
    const x = moving ? Math.sin(elapsed * 5) * 0.65 : 0;
    const y = moving ? Math.cos(elapsed * 5) * 0.65 : 0;
    return { simulated: true, tiltX: x, tiltY: y, gyro: { x: x * 24, y: y * 24, z: moving ? Math.sin(elapsed * 2) * 8 : 0 },
      activity: moving ? 1 : 0, mixed: this.reported ? null : elapsed >= SIMULATION_MIX_SECONDS ? 1 : Math.min(SCENARIO.successMixed * 0.99, elapsed / SIMULATION_MIX_SECONDS) };
  }
  complete(stage: ScenarioStage) {
    if (!this.finished || stage !== 'standby' || this.reported) return false;
    this.reported = true;
    return true;
  }
}
