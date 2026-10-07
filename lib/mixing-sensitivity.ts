export const MIXING_SENSITIVITY = { min: 0.25, max: 5, default: 1 } as const;

export const validMixingSensitivity = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= MIXING_SENSITIVITY.min && value <= MIXING_SENSITIVITY.max;

export const normalizeMixingSensitivity = (value: number): number =>
  validMixingSensitivity(value) ? Math.round(value * 1000) / 1000 : MIXING_SENSITIVITY.default;
