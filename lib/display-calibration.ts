export type DisplayRole = 'left' | 'right';
export type CalibrationRole = DisplayRole | 'center' | 'indicator';
export type DisplayCalibration = { x: number; y: number; scale: number };

// X/Y are CSS pixels from the centered artwork (side artboard or center bowl).
// Replace these only after fitting the actual printed enclosure.
export const DISPLAY_DEFAULTS: Record<CalibrationRole, DisplayCalibration> = {
  indicator: { x: 300, y: -300, scale: 1 },
  center: { x: 0, y: 0, scale: 1 },
  left: { x: 0, y: 0, scale: 1 },
  right: { x: 0, y: 0, scale: 1 },
};
export const calibrationKey = (role: CalibrationRole) => `vitani-prvaku.display-calibration.v1.${role}`;

export function normalizeCalibration(value: DisplayCalibration): DisplayCalibration {
  const clamp = (n: number, min: number, max: number, fallback: number) =>
    Number.isFinite(n) ? Math.round(Math.min(max, Math.max(min, n)) * 1000) / 1000 : fallback;
  return {
    x: clamp(value.x, -3000, 3000, 0),
    y: clamp(value.y, -3000, 3000, 0),
    scale: clamp(value.scale, 0.1, 4, 1),
  };
}

export function readCalibration(role: CalibrationRole, stored: string | null): DisplayCalibration {
  try {
    const value: unknown = stored ? JSON.parse(stored) : null;
    if (value && typeof value === 'object' && 'x' in value && 'y' in value && 'scale' in value
      && typeof value.x === 'number' && typeof value.y === 'number' && typeof value.scale === 'number') {
      return normalizeCalibration({ x: value.x, y: value.y, scale: value.scale });
    }
  } catch { /* A missing or damaged local setting must not hide the artwork. */ }
  return { ...DISPLAY_DEFAULTS[role] };
}
