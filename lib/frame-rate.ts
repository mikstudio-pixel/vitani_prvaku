export const FRAME_RATES = [30, 40, 60] as const;
export type FrameRate = typeof FRAME_RATES[number];
export const DEFAULT_FRAME_RATE: FrameRate = 60;
export const validFrameRate = (value: unknown): value is FrameRate => value === 30 || value === 40 || value === 60;

export const slowFrameRate = (measured: number, target: FrameRate) => measured < target * 5 / 6;
