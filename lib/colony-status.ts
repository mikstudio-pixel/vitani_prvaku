export const COLONY_COLORS = { positive: '#1279FF', medium: '#FF8500', negative: '#C4432B' } as const;
export type ColonyValue = { label: string; tone: keyof typeof COLONY_COLORS };
export type ColonyDirection = 'degrade' | 'improve';
export const DEFAULT_COLONY_DIRECTION: ColonyDirection = 'degrade';

/** Decorative colony readings share the measured mixing progress, like the rocket. */
export function colonyValues(progress: number, direction: ColonyDirection = DEFAULT_COLONY_DIRECTION): ColonyValue[] {
  const mixed = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const p = direction === 'degrade' ? 1 - mixed : mixed;
  const sleep = Math.round(4 + p * 4);
  return [
    p < 0.33 ? { label: 'Nízká', tone: 'negative' } : p < 0.66 ? { label: 'Střední', tone: 'medium' } : { label: 'Vysoká', tone: 'positive' },
    p < 0.25 ? { label: 'Nevím co dělám', tone: 'negative' } : p < 0.75 ? { label: 'Jde to', tone: 'medium' } : { label: 'Fantastická', tone: 'positive' },
    { label: `${sleep} ${sleep === 4 ? 'hodiny' : 'hodin'}`, tone: sleep <= 5 ? 'negative' : sleep === 6 ? 'medium' : 'positive' },
    p < 0.6 ? { label: 'Kritický', tone: 'negative' } : { label: 'Uklizená', tone: 'positive' },
    { label: 'Top strop', tone: 'positive' },
  ];
}
