import type { CalibrationRole, DisplayCalibration, DisplayRole } from './display-calibration';
import type { QrAnimationSettings } from './qr-animation-settings';
import type { ColonyDirection } from './colony-status';
import type { IntroSettings } from './intro-parameters';
import type { FrameRate } from './frame-rate';
import type { SoundSettings } from './sound-settings';
import type { ScenarioStage } from './mixing-scenario';

export type StoryClock = { stage: ScenarioStage; elapsed: number; remaining: number; deadline: 'start' | 'resume' | null };

export type RemoteCalibration = {
  connected: boolean;
  conflict: boolean;
  value?: DisplayCalibration | null;
  pending: boolean;
  saved: boolean;
  edit: number;
};
export type GyroAngles = { x: number; y: number; z: number };
export type TiltLight = { direction: number; strength: number };
export type NativeMotion = { x: number; y: number; angle: number; gyro?: GyroAngles; activity?: number; quiet?: number };
export type TrayRole = 'standalone' | 'host' | 'left' | 'right';
export type TrayPhase = 'ready' | 'mixing' | 'settling' | 'sleeping' | 'unavailable' | 'waking' | 'introducing';
export type TrayTelemetry = {
  phase: TrayPhase;
  tiltX: number;
  tiltY: number;
  activity: number;
  oil: number;
  elapsed: number;
  gyro?: GyroAngles;
  mixed?: number | null;
  light?: TiltLight | null;
  simulated?: boolean;
  quiet?: number;
  story?: StoryClock;
};
export type TraySync = {
  role: TrayRole;
  code: string;
  preview?: boolean;
  message: string;
  peers: number;
  telemetry?: TrayTelemetry | null;
  displays?: Partial<Record<DisplayRole, RemoteCalibration>>;
  calibrationCommand?: { request: number; value: DisplayCalibration } | null;
};
type NativeMessage = { command: 'ready' | 'presentation-ready' | 'tilt' | 'sleep-transition' | 'wake-transition'; enabled?: boolean } | { command: 'tray-state'; state: TrayTelemetry } | { command: 'benchmark-result'; result: unknown }
  | { command: 'calibration-report'; role: CalibrationRole; value: DisplayCalibration; request: number; saved: boolean }
  | { command: 'calibration-set'; role: DisplayRole; value: DisplayCalibration; edit: number }
  | { command: 'mixing-settings-report'; sensitivity: number; saved: boolean }
  | { command: 'frame-rate-report'; fps: FrameRate; saved: boolean }
  | { command: 'qr-settings-report'; value: QrAnimationSettings; saved: boolean }
  | { command: 'colony-settings-report'; direction: ColonyDirection; saved: boolean }
  | { command: 'intro-settings-report'; value: IntroSettings; saved: boolean }
  | { command: 'sound-settings-report'; value: SoundSettings; saved: boolean }
  | { command: 'audio-report'; state: string; decoded: number; played: number }
  | { command: 'simulation-ready'; enabled: boolean }
  | { command: 'simulation-complete' }
  | { command: 'session-complete' };

declare global {
  interface Window {
    __michasNative?: { paused: boolean; presentation?: boolean; sync?: TraySync; benchmark?: boolean; fps?: number };
    webkit?: { messageHandlers?: { michas?: { postMessage: (message: NativeMessage) => void } } };
  }
}

export const isNativeHost = () => typeof window !== 'undefined' && !!window.__michasNative;
export function reportSimulationReady(enabled: boolean) {
  window.webkit?.messageHandlers?.michas?.postMessage({ command: 'simulation-ready', enabled });
}
export function completeSession() {
  window.webkit?.messageHandlers?.michas?.postMessage({ command: 'session-complete' });
}
export function completeSimulation() {
  window.webkit?.messageHandlers?.michas?.postMessage({ command: 'simulation-complete' });
}
export function reportIntroSettings(value: IntroSettings, saved: boolean) {
  window.webkit?.messageHandlers?.michas?.postMessage({ command: 'intro-settings-report', value, saved });
}
export function reportSoundSettings(value: SoundSettings, saved: boolean) {
  window.webkit?.messageHandlers?.michas?.postMessage({ command: 'sound-settings-report', value, saved });
}
export function reportAudio(state: string, decoded: number, played: number) {
  window.webkit?.messageHandlers?.michas?.postMessage({ command: 'audio-report', state, decoded, played });
}
export const isNativePaused = () => window.__michasNative?.paused === true;
export function nativeCommand(command: 'ready' | 'presentation-ready' | 'tilt' | 'sleep-transition' | 'wake-transition', enabled?: boolean) {
  window.webkit?.messageHandlers?.michas?.postMessage({ command, enabled });
}
export function publishTrayState(state: TrayTelemetry) {
  if (window.__michasNative?.sync?.role === 'host' || window.__michasNative?.sync?.role === 'standalone') {
    window.webkit?.messageHandlers?.michas?.postMessage({ command: 'tray-state', state });
  }
}

export function reportMixingSensitivity(sensitivity: number, saved: boolean) {
  const role = window.__michasNative?.sync?.role;
  if (role === 'host' || role === 'standalone') {
    window.webkit?.messageHandlers?.michas?.postMessage({ command: 'mixing-settings-report', sensitivity, saved });
  }
}

export function reportFrameRate(fps: FrameRate, saved: boolean) {
  const role = window.__michasNative?.sync?.role;
  if (role === 'host' || role === 'standalone') {
    window.webkit?.messageHandlers?.michas?.postMessage({ command: 'frame-rate-report', fps, saved });
  }
}

export function reportQrAnimation(value: QrAnimationSettings, saved: boolean) {
  const role = window.__michasNative?.sync?.role;
  if (role === 'host' || role === 'standalone') {
    window.webkit?.messageHandlers?.michas?.postMessage({ command: 'qr-settings-report', value, saved });
  }
}

export function reportCalibration(role: CalibrationRole, value: DisplayCalibration, saved: boolean, request = 0) {
  const local = window.__michasNative?.sync?.role;
  if (local === role || ((role === 'center' || role === 'indicator') && (local === 'host' || local === 'standalone'))) {
    window.webkit?.messageHandlers?.michas?.postMessage({ command: 'calibration-report', role, value, saved, request });
  }
}

let calibrationEdit = Date.now();
export function setRemoteCalibration(role: DisplayRole, value: DisplayCalibration) {
  const edit = ++calibrationEdit;
  if (window.__michasNative?.sync?.role === 'host') {
    window.webkit?.messageHandlers?.michas?.postMessage({ command: 'calibration-set', role, value, edit });
  }
  return edit;
}
