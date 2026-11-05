import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { advanceGalleryFlow, emptyGalleryFlow, galleryStageLayout, type GalleryRow, type PortraitFlight } from '@/lib/gallery-flow';

import { placePortraitBubble, stepPortraitBubbles, type PortraitBubble } from '@/lib/portrait-bubbles';

function isHeld(element: HTMLElement) {
  return element.matches(':hover, :focus-within') || element.querySelector('[aria-busy="true"]') !== null;
}

/** Animate only the selected archive entries and pause portraits during operator interaction. */
export function PortraitStream<T extends GalleryRow>({ rows, children }: { rows: readonly T[]; children: (row: T) => ReactNode }) {
  const stage = useRef<HTMLDivElement>(null), flow = useRef(emptyGalleryFlow());
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const simulation = useRef({ width: 0, height: 0, bubbles: new Map<HTMLElement, PortraitBubble>() });
  const [flights, setFlights] = useState<PortraitFlight[]>([]);
  const layout = galleryStageLayout(bounds.width, bounds.height);
  const byId = new Map(rows.map(row => [row.id, row]));
  const columns = Math.max(1, Math.min(layout.capacity, Math.floor(bounds.width / Math.max(1, layout.size))));
  const staticRows = Math.max(1, Math.ceil(layout.capacity / columns));
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(([entry]) => setBounds({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    /** Refresh selection while leaving the CSS animation clocks and operator-held portraits intact. */
    const tick = () => {
      if (document.hidden) return;
      const held = new Set<string>();
      stage.current?.querySelectorAll<HTMLElement>('.gallery-flight').forEach(element => {
        if (isHeld(element) && element.dataset.portraitId) held.add(element.dataset.portraitId);
      });
      flow.current = advanceGalleryFlow(flow.current, rows, Date.now(), layout.capacity, held);
      setFlights(flow.current.flights);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [rows, layout.capacity]);
  useLayoutEffect(() => {
    if (!stage.current || !layout.size) return;
    const { width, height } = bounds;
    const model = simulation.current;
    if (model.width !== width || model.height !== height) {
      model.width = width;
      model.height = height;
      model.bubbles.clear();
    }

    const elements = new Map(Array.from(stage.current.querySelectorAll<HTMLElement>('[data-flight-key]'),
      element => [Number(element.dataset.flightKey), element]));
    const activeElements = new Set(elements.values());
    for (const element of model.bubbles.keys()) {
      if (!activeElements.has(element)) model.bubbles.delete(element);
    }
    for (const flight of flights) {
      const element = elements.get(flight.key);
      if (!element || model.bubbles.has(element)) continue;
      const radius = layout.size * flight.scale / 2;
      const travel = width - radius * 2;
      const x = height > width * 1.15
        ? .12 + flight.slot % 2 * .68 + (flight.x - .5) * .18
        : flight.x;
      const age = -flight.delay / 1000;
      const duration = flight.duration / 1000;
      const rise = (height + 20) / duration;
      const drift = flight.drift * travel * .45;
      const bubble = {
        x: radius + travel * x, y: height - radius - rise * age, radius,
        vx: drift * Math.cos(age * .65), vy: -rise, rise, drift, age, held: false,
      };
      placePortraitBubble(bubble, [...model.bubbles.values()], width, height);
      model.bubbles.set(element, bubble);
    }

    const entries = [...model.bubbles];
    if (!entries.length) return;
    const bubbles = entries.map(([, bubble]) => bubble);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let last = 0;
    let frame = 0;
    const paint = () => {
      for (const [element, bubble] of entries) {
        element.style.setProperty('--bubble-x', `${bubble.x - bubble.radius}px`);
        element.style.setProperty('--bubble-y', `${bubble.y - bubble.radius}px`);
        element.style.setProperty('--bubble-visibility', 'visible');
      }
    };
    const animate = (now: number) => {
      const seconds = last ? Math.min((now - last) / 1000, 1 / 30) : 0;
      last = now;
      for (const [element, bubble] of entries) bubble.held = isHeld(element);
      stepPortraitBubbles(bubbles, width, seconds);
      paint();
      frame = requestAnimationFrame(animate);
    };
    const restart = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (reducedMotion.matches || document.hidden) return;
      paint();
      frame = requestAnimationFrame(animate);
    };
    restart();
    reducedMotion.addEventListener('change', restart);
    document.addEventListener('visibilitychange', restart);
    return () => {
      cancelAnimationFrame(frame);
      reducedMotion.removeEventListener('change', restart);
      document.removeEventListener('visibilitychange', restart);
    };
  }, [bounds, flights, layout.size]);

  return <div ref={stage} className="gallery-stage" aria-label="Poletující portréty návštěvníků">
    {flights.map(flight => {
      const row = byId.get(flight.id);
      if (!row) return null;
      const size = layout.size * flight.scale;
      const style = {
        width: size, height: size,
        animationDuration: `${flight.duration}ms`, animationDelay: `${flight.delay}ms`,
        '--flight-tilt': `${flight.tilt}deg`,
        '--still-x': `${(flight.slot % columns + .5) * bounds.width / columns - size / 2}px`,
        '--still-y': `${(Math.floor(flight.slot / columns) + .5) * bounds.height / staticRows - size / 2}px`,
      } as CSSProperties;
      return <div key={flight.key} className="gallery-flight" data-featured={flight.featured} data-flight-key={flight.key} data-portrait-id={row.id} style={style}>{children(row)}</div>;
    })}
  </div>;
}
