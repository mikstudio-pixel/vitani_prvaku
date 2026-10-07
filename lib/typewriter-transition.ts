export type GlyphRegion = { x: number; y: number; width: number; height: number };

/** Incoming glyphs erase intersecting old glyphs even when character widths differ. */
export function replacedByIncoming(old: GlyphRegion, incoming: readonly GlyphRegion[]): boolean {
  return incoming.some(next => old.x < next.x + next.width && old.x + old.width > next.x
    && old.y < next.y + next.height && old.y + old.height > next.y);
}
