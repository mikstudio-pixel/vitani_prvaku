import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { advanceGalleryFlow, emptyGalleryFlow, galleryStageLayout, type GalleryRow, type PortraitFlight } from '@/lib/gallery-flow';

export function PortraitStream<T extends GalleryRow>({ rows, children }: { rows: readonly T[]; children: (row: T) => ReactNode }) {
  const stage = useRef<HTMLDivElement>(null), flow = useRef(emptyGalleryFlow());
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [flights, setFlights] = useState<PortraitFlight[]>([]);
  const layout = galleryStageLayout(bounds.width, bounds.height);
  const byId = new Map(rows.map(row => [row.id, row]));
  const columns = Math.max(1, Math.ceil(Math.sqrt(flights.length * bounds.width / Math.max(1, bounds.height))));
  const staticRows = Math.max(1, Math.ceil(flights.length / columns));
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(([entry]) => setBounds({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
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
    {flights.map((flight, index) => {
      const row = byId.get(flight.id);
      if (!row) return null;
      const size = layout.size * flight.scale;
      const travel = Math.max(0, bounds.width - size);
      const clamp = (x: number) => Math.max(0, Math.min(1, x));
      const style = {
        width: size, height: size, zIndex: flight.featured ? 1 : undefined,
        animationDuration: `${flight.duration}ms`, animationDelay: `${flight.delay}ms`,
        '--flight-x': `${travel * flight.x}px`, '--flight-mid-x': `${travel * clamp(flight.x + flight.drift)}px`,
        '--flight-end-x': `${travel * clamp(flight.x - flight.drift)}px`,
        '--flight-start-y': `${Math.max(0, bounds.height - size)}px`, '--flight-mid-y': `${(bounds.height - size) * .4}px`,
        '--flight-end-y': `${-size - 20}px`, '--flight-tilt': `${flight.tilt}deg`,
        '--still-x': `${(index % columns + .5) * bounds.width / columns - size / 2}px`,
        '--still-y': `${(Math.floor(index / columns) + .5) * bounds.height / staticRows - size / 2}px`,
      } as CSSProperties;
      return <div key={flight.key} className="gallery-flight" data-portrait-id={row.id} style={style}>{children(row)}</div>;
    })}
  </div>;
}
