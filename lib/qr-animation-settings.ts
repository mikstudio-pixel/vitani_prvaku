import { QR_REVEAL_SECONDS } from './qr-pattern';

export type QrAnimationSettings = { revealSeconds: number; disperseSpeed: number };
export const QR_ANIMATION_LIMITS = { revealMin: 5, revealMax: 30, disperseMin: 0.25, disperseMax: 3 } as const;
export const DEFAULT_QR_ANIMATION: QrAnimationSettings = { revealSeconds: QR_REVEAL_SECONDS, disperseSpeed: 1 };

export function validQrAnimation(value: unknown): value is QrAnimationSettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as QrAnimationSettings;
  return typeof settings.revealSeconds === 'number' && Number.isFinite(settings.revealSeconds)
    && settings.revealSeconds >= QR_ANIMATION_LIMITS.revealMin && settings.revealSeconds <= QR_ANIMATION_LIMITS.revealMax
    && typeof settings.disperseSpeed === 'number' && Number.isFinite(settings.disperseSpeed)
    && settings.disperseSpeed >= QR_ANIMATION_LIMITS.disperseMin && settings.disperseSpeed <= QR_ANIMATION_LIMITS.disperseMax;
}

export function normalizeQrAnimation(value: QrAnimationSettings): QrAnimationSettings {
  return validQrAnimation(value)
    ? { revealSeconds: Math.round(value.revealSeconds * 1000) / 1000, disperseSpeed: Math.round(value.disperseSpeed * 1000) / 1000 }
    : { ...DEFAULT_QR_ANIMATION };
}

export const sameQrAnimation = (a: QrAnimationSettings, b: QrAnimationSettings) =>
  Math.abs(a.revealSeconds - b.revealSeconds) < 0.00051 && Math.abs(a.disperseSpeed - b.disperseSpeed) < 0.00051;
