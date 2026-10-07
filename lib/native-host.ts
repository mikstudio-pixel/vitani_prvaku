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
// Shared simulation interfaces remain available, but this event never reads
// an injected Designblok host or sends messages to its native handlers.
export const isNativeHost = (): boolean => false;
export const isNativePaused = (): boolean => false;
export function reportSimulationReady(_enabled: boolean) {}
export function completeSession() {}
export function completeSimulation() {}
export function reportIntroSettings(_value: IntroSettings, _saved: boolean) {}
export function reportSoundSettings(_value: SoundSettings, _saved: boolean) {}
export function reportAudio(_state: string, _decoded: number, _played: number) {}
export function nativeCommand(_command: 'ready' | 'presentation-ready' | 'tilt' | 'sleep-transition' | 'wake-transition', _enabled?: boolean) {}
export function publishTrayState(_state: TrayTelemetry) {}
export function reportMixingSensitivity(_sensitivity: number, _saved: boolean) {}
export function reportFrameRate(_fps: FrameRate, _saved: boolean) {}
export function reportQrAnimation(_value: QrAnimationSettings, _saved: boolean) {}
export function reportCalibration(_role: CalibrationRole, _value: DisplayCalibration, _saved: boolean, _request = 0) {}
export function setRemoteCalibration(_role: DisplayRole, _value: DisplayCalibration) { return 0; }
