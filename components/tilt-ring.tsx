import { useEffect, useRef, type RefObject } from 'react';
import type { Tilt } from '@/lib/tilt';
import { LED_COUNT, lightFromTilt, restingLightSpan, ringLights, ringSegmentLevels, TiltLightMotion } from '@/lib/tilt-light';
import type { MixingIndicator } from '@/lib/mixing-indicator';
import type { WakeIntro } from '@/lib/wake-intro';

const angles = Array.from({ length: LED_COUNT }, (_, i) => i * 360 / LED_COUNT);
const shape = (() => {
  const outer = 97.3, inner = 93.7, corner = 0.7;
  const half = restingLightSpan / 2, rounding = corner / 95.5;
  const point = (r: number, a: number) => `${(100 + r * Math.sin(a)).toFixed(4)} ${(100 - r * Math.cos(a)).toFixed(4)}`;
  return [`M ${point(outer, -half + rounding)}`, `A ${outer} ${outer} 0 0 1 ${point(outer, half - rounding)}`,
    `Q ${point(outer, half)} ${point(outer - corner, half)}`, `L ${point(inner + corner, half)}`,
    `Q ${point(inner, half)} ${point(inner, half - rounding)}`, `A ${inner} ${inner} 0 0 0 ${point(inner, -half + rounding)}`,
    `Q ${point(inner, -half)} ${point(inner + corner, -half)}`, `L ${point(outer - corner, -half)}`,
    `Q ${point(outer, -half)} ${point(outer, -half + rounding)} Z`].join(' ');
})();

/** Fixed physical LEDs: only whole-segment brightness changes, never geometry. */
export function TiltRing({ tilt, wake, story, finaleDirection, running, preview }: {
  tilt: RefObject<Tilt>; wake: RefObject<WakeIntro>; story: RefObject<MixingIndicator>; running: boolean;
  finaleDirection?: RefObject<number>;
  preview?: ReturnType<typeof ringLights>;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const levels = preview ? ringSegmentLevels(preview) : null;
  useEffect(() => {
    const node = svg.current;
    if (!node || !running) return;
    const lights = Array.from(node.querySelectorAll<SVGPathElement>('.led-light path'));
    const peaks = Array.from(node.querySelectorAll<SVGPathElement>('.led-peak path'));
    const motion = new TiltLightMotion();
    let animation = 0, previous = performance.now();
    const tick = (now: number) => {
      motion.receive(lightFromTilt(tilt.current));
      const signal = motion.advance(Math.min(0.1, (now - previous) / 1000));
      previous = now;
      const value = ringLights(wake.current.frame(now / 1000), signal, story.current.storyFrame, finaleDirection?.current);
      ringSegmentLevels(value).forEach((level, index) => {
        lights[index].setAttribute('opacity', String(level.light));
        peaks[index].setAttribute('opacity', String(level.peak));
      });
      node.dataset.phase = value.phase;
      node.dataset.span = String(value.span);
      node.dataset.direction = String(value.angle);
      node.dataset.strength = String(signal.strength);
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [running, tilt, wake, story, finaleDirection]);

  return <LedRing svg={svg} levels={levels ?? undefined} />;
}

export function LedRing({ svg, levels }: { svg?: RefObject<SVGSVGElement | null>; levels?: { light: number; peak: number }[] }) {
  return <svg ref={svg} className="tilt-ring" viewBox="0 0 200 200" aria-hidden="true">
    {angles.map(angle => <path key={angle} d={shape} className="led-housing" transform={`rotate(${angle} 100 100)`} />)}
    {/* Two shared glow passes, rather than a separate GPU filter for every LED. */}
    {['led-light', 'led-peak'].map(layer => <g key={layer} className={layer}>
      {angles.map((angle, index) => <path key={angle} className="led-emitter" data-emitter={index} d={shape} transform={`rotate(${angle} 100 100)`} opacity={levels ? levels[index][layer === 'led-light' ? 'light' : 'peak'] : 0} />)}
    </g>)}
  </svg>;
}
