import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { advanceGalleryFlow, emptyGalleryFlow, galleryStageLayout, type GalleryRow, type PortraitFlight } from '@/lib/gallery-flow';

/** Animate only the selected archive entries and pause portraits during operator interaction. */
export function PortraitStream<T extends GalleryRow>({ rows, children }: { rows: readonly T[]; children: (row: T) => ReactNode }) {
  const stage = useRef<HTMLDivElement>(null), flow = useRef(emptyGalleryFlow());
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
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
        if (element.matches(':hover, :focus-within') || element.querySelector('[aria-busy="true"]')) held.add(element.dataset.portraitId!);
      });
      flow.current = advanceGalleryFlow(flow.current, rows, Date.now(), layout.capacity, held);
      setFlights(flow.current.flights);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [rows, layout.capacity]);
  return <div ref={stage} className="gallery-stage" aria-label="Poletující portréty návštěvníků">
    {flights.map(flight => {
      const row = byId.get(flight.id);
      if (!row) return null;
      const size = layout.size * flight.scale;
      const travel = Math.max(0, bounds.width - size);
      const clamp = (x: number) => Math.max(0, Math.min(1, x));
      const x = bounds.height > bounds.width * 1.15
        ? clamp(.12 + flight.slot % 2 * .68 + (flight.x - .5) * .18)
        : flight.x;
      const style = {
        width: size, height: size,
        animationDuration: `${flight.duration}ms`, animationDelay: `${flight.delay}ms`,
        '--flight-x': `${travel * x}px`, '--flight-mid-x': `${travel * clamp(x + flight.drift)}px`,
        '--flight-end-x': `${travel * clamp(x - flight.drift)}px`,
        '--flight-start-y': `${Math.max(0, bounds.height - size)}px`, '--flight-mid-y': `${(bounds.height - size) * .4}px`,
        '--flight-end-y': `${-size - 20}px`, '--flight-tilt': `${flight.tilt}deg`,
        '--still-x': `${(flight.slot % columns + .5) * bounds.width / columns - size / 2}px`,
        '--still-y': `${(Math.floor(flight.slot / columns) + .5) * bounds.height / staticRows - size / 2}px`,
      } as CSSProperties;
      return <div key={flight.key} className="gallery-flight" data-featured={flight.featured} data-portrait-id={row.id} style={style}>{children(row)}</div>;
    })}
  </div>;
}
