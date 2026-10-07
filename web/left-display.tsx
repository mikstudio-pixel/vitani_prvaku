import { useLayoutEffect, useMemo, useRef } from 'react';
import type { WakeFrame } from '@/lib/wake-intro';
import type { ScenarioStage } from '@/lib/mixing-scenario';
import { INTRO, trackProgress } from '@/lib/intro-animation';
import { isNativePaused } from '@/lib/native-host';
import { colonyValues, DEFAULT_COLONY_DIRECTION, type ColonyDirection } from '@/lib/colony-status';
import { mountColonyValues } from './left-colony';
import artwork from './artwork/left-standby.svg?raw';
import { markStartupElements } from '@/lib/startup-flicker';

const namespace = 'http://www.w3.org/2000/svg';
const ages = Array.from({ length: 11 }, (_, i) => i + 12);
const cardCenters = ages.map(age => 1439.5 + (age - 20) * 57.25);

/** Animate the original outlined layers, retaining Figma's paths and final pose. */
export function LeftDisplay({ intro, progress, stage, colonyDirection = DEFAULT_COLONY_DIRECTION, idPrefix = '' }: { intro: WakeFrame; progress: number | null; stage: ScenarioStage; colonyDirection?: ColonyDirection; idPrefix?: string }) {
  const markup = useMemo(() => ({ __html: artwork.replace(/\b(id="|url\(#)((?:mask|paint|clip)[\w-]+)/g, `$1${idPrefix}$2`) }), [idPrefix]);
  const root = useRef<HTMLElement>(null);
  const flight = useRef(0);
  const colony = useRef<ReturnType<typeof mountColonyValues> | null>(null);
  const colonyProgress = useRef(0);
  const orbit = useRef<SVGGElement | null>(null);
  const orbitClock = useRef({ elapsed: 0, receivedAt: 0 });
  const layers = useRef<{
    row: SVGGElement; cards: { group: SVGGElement; rect: SVGRectElement; number: SVGElement }[];
    plane: SVGPathElement; route: SVGPathElement; length: number; tangent: number;
  } | null>(null);

  useLayoutEffect(() => {
    const svg = root.current!.querySelector('svg')!;
    markStartupElements(svg);
    const layer = <T extends SVGElement>(id: string) => svg.querySelector<T>(`[id="${id}"]`)!;
    colony.current = mountColonyValues(svg, idPrefix);
    const destination = layer<SVGGElement>('Group 105209_21');
    const circles = document.createElementNS(namespace, 'g');
    circles.dataset.destinationOrbit = '';
    destination.insertBefore(circles, destination.firstChild);
    // The flight path and rocket share this Figma group: rotate its circles only.
    Array.from(destination.querySelectorAll('circle')).forEach(circle => circles.appendChild(circle));
    orbit.current = circles;
    const row = layer<SVGGElement>('Frame 2147207671_21');
    const clip = document.createElementNS(namespace, 'clipPath');
    clip.id = `${idPrefix}wake-age-clip`;
    const bounds = document.createElementNS(namespace, 'rect');
    for (const [name, value] of Object.entries({ x: 1301, y: 5533, width: 277, height: 42 })) bounds.setAttribute(name, String(value));
    clip.appendChild(bounds); svg.querySelector('defs')!.appendChild(clip);
    const wrapper = document.createElementNS(namespace, 'g');
    wrapper.setAttribute('clip-path', `url(#${clip.id})`);
    row.replaceWith(wrapper); wrapper.appendChild(row);
    const added: SVGGElement[] = [];
    // Extend the offscreen strip too: no blank cells may enter the viewport.
    for (let age = 12; age < 18; age++) {
      const group = document.createElementNS(namespace, 'g');
      const rect = document.createElementNS(namespace, 'rect');
      const number = document.createElementNS(namespace, 'text');
      number.textContent = String(age);
      for (const [name, value] of Object.entries({ x: cardCenters[age - 12], y: 5561.51, 'text-anchor': 'middle', 'font-family': 'PP Neue Machina', 'font-weight': 700, 'font-size': 22 })) number.setAttribute(name, String(value));
      group.appendChild(rect); group.appendChild(number); added.push(group);
    }
    for (const group of added) row.insertBefore(group, row.children[added.indexOf(group)]);
    const cards = Array.from(row.children).map(child => {
      const group = child as SVGGElement;
      const rects = group.querySelectorAll('rect');
      // Combine the selected card's separate fill and border into one rectangle.
      if (rects[1]) rects[1].style.display = 'none';
      return { group, rect: rects[0], number: group.querySelector<SVGElement>('path,text')! };
    });
    const route = layer<SVGPathElement>('Golden Ratio Arc — Bézier_42');
    const length = route.getTotalLength(), start = route.getPointAtLength(0), next = route.getPointAtLength(1);
    layers.current = { row, cards, route, length, plane: layer('Vector_61'), tangent: Math.atan2(start.y - next.y, start.x - next.x) * 180 / Math.PI };
    return () => {
      wrapper.replaceWith(row); clip.remove(); added.forEach(group => group.remove()); layers.current = null;
      colony.current?.dispose(); colony.current = null;
      circles.replaceWith(...Array.from(circles.childNodes)); orbit.current = null;
    };
  }, [idPrefix]);

  useLayoutEffect(() => {
    if (intro.stage !== 'complete' || stage === 'standby') colonyProgress.current = 0;
    else if (!['detected', 'panels', 'authorized', 'decision', 'countdown'].includes(stage) && progress !== null && Number.isFinite(progress)) colonyProgress.current = progress;
    colony.current?.update(colonyValues(colonyProgress.current, colonyDirection));
  }, [intro.stage, progress, stage, colonyDirection]);

  useLayoutEffect(() => {
    orbitClock.current = { elapsed: intro.elapsed, receivedAt: performance.now() };
  }, [intro.stage, intro.elapsed]);

  useLayoutEffect(() => {
    const circles = orbit.current;
    if (!circles) return;
    circles.removeAttribute('transform');
    if (intro.stage !== 'panels') return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const enabled = () => !document.hidden && !isNativePaused() && !reducedMotion.matches;
    const tick = (now: number) => {
      frame = 0;
      if (!enabled()) return;
      // Follow the shared intro clock, interpolating between its 30 Hz updates.
      const clock = orbitClock.current;
      const elapsed = clock.elapsed + Math.max(0, Math.min(0.1, (now - clock.receivedAt) / 1000));
      const travel = trackProgress(elapsed, INTRO.panels.destinationOrbit);
      circles.setAttribute('transform', `rotate(${-360 * travel} 1566.16 5793.16)`);
      if (travel < 1) frame = requestAnimationFrame(tick);
    };
    const refresh = () => {
      cancelAnimationFrame(frame); frame = 0;
      if (enabled()) frame = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('vitani-prvaku:power', refresh);
    reducedMotion.addEventListener('change', refresh);
    refresh();
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('vitani-prvaku:power', refresh);
      reducedMotion.removeEventListener('change', refresh);
    };
  }, [intro.stage]);

  useLayoutEffect(() => {
    const parts = layers.current;
    if (!parts) return;
    const elapsed = intro.stage === 'complete' ? Infinity : intro.stage === 'panels' ? intro.elapsed : -Infinity;
    const entry = trackProgress(elapsed, INTRO.panels.stripEntry), travel = trackProgress(elapsed, INTRO.panels.stripTravel);
    const offset = 229 * (1 - travel) - 28 * (1 - entry);
    parts.row.setAttribute('transform', `translate(${offset} 0)`);
    parts.row.setAttribute('opacity', String(entry));
    const selected = cardCenters.reduce((best, center, index) => Math.abs(center + offset - 1439.5) < Math.abs(cardCenters[best] + offset - 1439.5) ? index : best, 0);
    root.current!.dataset.ageSelected = String(ages[selected]);
    parts.cards.forEach(({ rect, number }, index) => {
      const active = selected === index;
      const values = {
        x: cardCenters[index] - (active ? 23.5 : 24), y: active ? 5534.5 : 5534,
        width: active ? 47 : 48, height: active ? 39 : 40, rx: active ? 9.5 : 10,
        fill: active ? '#1271FF' : 'white', 'fill-opacity': active ? 0.2 : 0.08,
        stroke: active ? '#1279FF' : 'none',
      };
      for (const [name, value] of Object.entries(values)) rect.setAttribute(name, String(value));
      number.setAttribute('fill', active ? '#1279FF' : '#BFBAB2');
      number.setAttribute('fill-opacity', active ? '1' : '0.4');
    });
  }, [intro.stage, intro.elapsed]);

  useLayoutEffect(() => {
    const parts = layers.current;
    if (!parts) return;
    if (intro.stage !== 'complete') flight.current = 0;
    // Use the same measured/frozen result as the right panel. Missing data
    // stops the flight; waking resets it for the new portion.
    const target = intro.stage !== 'complete' ? 0
      : progress !== null && Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : flight.current;
    const draw = () => {
      const distance = parts.length * (1 - flight.current);
      const point = parts.route.getPointAtLength(distance);
      const ahead = parts.route.getPointAtLength(Math.max(0, distance - 1));
      const behind = parts.route.getPointAtLength(Math.min(parts.length, distance + 1));
      const origin = parts.route.getPointAtLength(0);
      const rotation = Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180 / Math.PI - parts.tangent;
      parts.plane.setAttribute('transform', `translate(${point.x - origin.x} ${point.y - origin.y}) rotate(${rotation} ${origin.x} ${origin.y})`);
      parts.route.setAttribute('stroke-dasharray', String(parts.length));
      parts.route.setAttribute('stroke-dashoffset', String(-distance));
      if (flight.current === 1) {
        parts.plane.removeAttribute('transform');
        parts.route.removeAttribute('stroke-dasharray');
        parts.route.removeAttribute('stroke-dashoffset');
      }
      root.current!.dataset.flightProgress = String(flight.current);
    };
    draw();
    let frame = 0, previous = performance.now();
    const animate = (now: number) => {
      // Smooth the ~5 Hz measurements at display refresh rate, in either
      // direction, without extrapolating beyond the measured progress.
      flight.current += (target - flight.current) * (1 - Math.exp(-(now - previous) / 120));
      previous = now;
      if (Math.abs(target - flight.current) < 0.0001) flight.current = target;
      draw();
      if (flight.current !== target) frame = requestAnimationFrame(animate);
    };
    if (flight.current !== target) frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [intro.stage, progress]);

  return <figure className="left-display" ref={root} aria-label="ADD — informace o misi. 20 let, bakalářské studium 3 roky, magisterské 2 roky. Cílová destinace ADD Zlín, vzdálenost 253 km. Kolonie ADD." dangerouslySetInnerHTML={markup} />;
}
