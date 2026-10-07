import { DEFAULT_FRAME_RATE, validFrameRate, type FrameRate } from './frame-rate';
import { reportFrameRate } from './native-host';

export const FRAME_RATE_KEY = 'vitani-prvaku.frame-rate';

export function bindFrameRate(apply: (fps: FrameRate) => void): () => void {
  const update = (fps: FrameRate) => {
    apply(fps);
    let saved = false;
    try {
      window.localStorage.setItem(FRAME_RATE_KEY, String(fps));
      saved = window.localStorage.getItem(FRAME_RATE_KEY) === String(fps);
    } catch { /* Keep the live limit when storage is unavailable. */ }
    reportFrameRate(fps, saved);
  };
  let initial = DEFAULT_FRAME_RATE;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(FRAME_RATE_KEY) ?? 'null');
    if (validFrameRate(value)) initial = value;
  } catch { /* Missing or corrupt settings preserve the current default. */ }
  update(initial);
  const receive = (event: Event) => {
    const fps: unknown = (event as CustomEvent).detail;
    if (validFrameRate(fps)) update(fps);
  };
  window.addEventListener('michas:frame-rate', receive);
  return () => window.removeEventListener('michas:frame-rate', receive);
}
