export type GalleryRow = { id: string; created_at: string };
export type PortraitFlight = {
  id: string;
  key: number;
  expiresAt: number;
  duration: number;
  delay: number;
  x: number;
  drift: number;
  scale: number;
  tilt: number;
  featured: boolean;
};
export type GalleryFlow = {
  flights: PortraitFlight[];
  known: Set<string>;
  shown: Map<string, number>;
  sequence: number;
  updatedAt: number;
};
export const emptyGalleryFlow = (): GalleryFlow => ({ flights: [], known: new Set(), shown: new Map(), sequence: 0, updatedAt: 0 });

export function galleryStageLayout(width: number, height: number) {
  if (width <= 0 || height <= 0) return { size: 0, capacity: 0 };
  const size = Math.min(width, height, Math.max(88, Math.min(220, width * .26, height * .34)));
  return { size, capacity: Math.max(1, Math.min(12, Math.floor(width * height / (size * size * 2.8)))) };
}

// Recent portraits get up to eight times the weight, fading to normal in five minutes.
function weight(row: GalleryRow, now: number) {
  const age = Math.max(0, now - Date.parse(row.created_at));
  return 1 + 7 * Math.max(0, 1 - age / 300000);
}

export function advanceGalleryFlow(
  previous: GalleryFlow, rows: readonly GalleryRow[], now: number, capacity: number,
  held: ReadonlySet<string> = new Set(), random: () => number = Math.random,
): GalleryFlow {
  if (!rows.length) return emptyGalleryFlow();
  if (capacity <= 0) return previous;
  const known = new Set(rows.map(row => row.id));
  const shown = new Map([...previous.shown].filter(([id]) => known.has(id)));
  const elapsed = Math.max(0, now - previous.updatedAt);
  let flights = previous.flights.filter(flight => known.has(flight.id) && (flight.expiresAt > now || held.has(flight.id)))
    .map(flight => held.has(flight.id) ? { ...flight, expiresAt: flight.expiresAt + elapsed } : flight);
  // Keep the latest arrivals when the screen becomes smaller.
  flights = flights.slice(-capacity);
  let sequence = previous.sequence;
  const launch = (row: GalleryRow, immediate: boolean, scatter: boolean) => {
    const duration = 18000 + random() * 12000;
    const offset = scatter ? random() * duration * .8 : 0;
    flights.push({ id: row.id, key: ++sequence, expiresAt: now + duration - offset,
      duration, delay: -offset, x: .05 + random() * .9, drift: (random() - .5) * .35,
      scale: immediate ? 1 : .8 + random() * .2, tilt: (random() - .5) * 12, featured: immediate });
    shown.set(row.id, now);
  };
  // A new Realtime/polling arrival gets a visible slot immediately, without duplicates.
  const arrivals = previous.known.size ? rows.filter(row => !previous.known.has(row.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).slice(0, capacity).reverse() : [];
  if (!previous.known.size) {
    const latest = rows.reduce((a, b) => a.created_at > b.created_at || a.created_at === b.created_at && a.id > b.id ? a : b);
    launch(latest, true, false);
  }
  for (const row of arrivals) {
    if (flights.length >= capacity) {
      const replace = flights.findIndex(flight => !held.has(flight.id));
      if (replace < 0) { known.delete(row.id); continue; }
      flights.splice(replace, 1);
    }
    launch(row, true, false);
  }
  while (flights.length < Math.min(capacity, rows.length)) {
    const visible = new Set(flights.map(flight => flight.id));
    const candidates = rows.filter(row => !visible.has(row.id));
    // Prefer variety over immediately repeating a portrait that just left.
    const rested = candidates.filter(row => now - (shown.get(row.id) ?? -Infinity) >= 45000);
    const pool = rested.length ? rested : candidates;
    const total = pool.reduce((sum, row) => sum + weight(row, now), 0);
    let ticket = random() * total;
    const chosen = pool.find(row => { ticket -= weight(row, now); return ticket <= 0; }) ?? pool[pool.length - 1];
    launch(chosen, false, !previous.known.size);
  }
  return { flights, known, shown, sequence, updatedAt: now };
}
