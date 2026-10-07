import { LedRing } from './tilt-ring';
import { LED_COUNT } from '@/lib/tilt-light';

export function PortraitRing({ progress, flash }: { progress: number; flash: number | null }) {
  const brightness = flash === null ? null : Math.floor(flash / .2) % 2 === 0 ? 1 : 0;
  const levels = Array.from({ length: LED_COUNT }, (_, index) => {
    const light = brightness ?? Math.max(0, Math.min(1, progress * LED_COUNT - index));
    return { light, peak: light * .85 };
  });
  return <LedRing levels={levels} />;
}
