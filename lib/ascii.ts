import type { Tilt } from './tilt';

// Every visible mark is a font glyph. The pattern shifts with the tray's slosh.
export function asciiBowl(offset: Tilt, oil: number) {
  const columns = 23, rows = 13;
  const ramp = ' .:+*O@';
  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = '';
    for (let x = 0; x < columns; x++) {
      const nx = (x - (columns - 1) / 2) / ((columns - 1) / 2);
      const ny = (y - (rows - 1) / 2) / ((rows - 1) / 2);
      const radius = Math.hypot(nx, ny);
      if (radius > 1.02) { line += ' '; continue; }
      if (radius > .93) { line += radius > .99 ? '.' : ':'; continue; }
      const px = nx - offset.x * 4 * (1 - radius * radius);
      const py = ny + offset.y * 4 * (1 - radius * radius);
      const angle = Math.atan2(py, px), shiftedRadius = Math.hypot(px, py);
      const swirl = Math.sin(angle * 3 + shiftedRadius * 19 + Math.sin(angle * 4 - shiftedRadius * 6)) * .5 + .5;
      const granules = Math.sin(px * 21 + Math.sin(py * 9)) * Math.cos(py * 17);
      const sheen = Math.max(0, Math.sin(px * 9) * Math.cos(py * 8) - .45) * oil;
      const density = Math.max(0, Math.min(.999, swirl * .56 + granules * .16 + .14 + sheen * .5));
      line += ramp[Math.floor(density * ramp.length)];
    }
    lines.push(line);
  }
  return lines.join('\n');
}
