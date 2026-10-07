import { introCurve, introValue } from './intro-parameters';
/** Časy v sekundách; curve má stejný formát jako CSS cubic-bezier(x1, y1, x2, y2). */
export type Curve = readonly [number, number, number, number];
export type AnimationTrack = { delay: number; duration: number; curve: Curve };
const track = (name: string): AnimationTrack => ({
  get delay() { return introValue(`panels.${name}.delay`); },
  get duration() { return introValue(`panels.${name}.duration`); },
  get curve() { return curve(`panels.${name}`); },
});
const curve = introCurve;
export const INTRO = {
  ring: {
    blink: {
      get count() { return introValue('ring.blink.count'); },
      get fadeOut() { return introValue('ring.blink.fadeOut'); },
      get dark() { return introValue('ring.blink.dark'); },
      get fadeIn() { return introValue('ring.blink.fadeIn'); },
      get lit() { return introValue('ring.blink.lit'); },
    },
    collapse: { get duration() { return introValue('ring.collapse.duration'); }, get curve() { return curve('ring.collapse'); } },
  },
  panels: {
    color: track('color'), stripEntry: track('stripEntry'), stripTravel: track('stripTravel'), destinationOrbit: track('destinationOrbit'),
    get pauseAfter() { return introValue('panels.pauseAfter'); },
  },
};
export const blinkDuration = () => { const b = INTRO.ring.blink; return b.fadeOut + b.dark + b.fadeIn + b.lit; };
export const ringDuration = () => INTRO.ring.blink.count * blinkDuration() + INTRO.ring.collapse.duration;
export const panelsDuration = () => Math.max(...[INTRO.panels.color, INTRO.panels.stripEntry, INTRO.panels.stripTravel, INTRO.panels.destinationOrbit].map(t => t.delay + t.duration)) + INTRO.panels.pauseAfter;

/** Invert the curve's x coordinate, so its control points behave like CSS. */
export function curveProgress(value: number, [x1, y1, x2, y2]: Curve): number {
  const p = Math.max(0, Math.min(1, value));
  if (p === 0 || p === 1) return p;
  const cubic = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2;
    if (cubic(t, x1, x2) < p) lo = t; else hi = t;
  }
  return cubic((lo + hi) / 2, y1, y2);
}

export function trackProgress(elapsed: number, track: AnimationTrack) {
  return curveProgress(track.duration > 0 ? (elapsed - track.delay) / track.duration : elapsed >= track.delay ? 1 : 0, track.curve);
}
