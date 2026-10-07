import { DEFAULT_QR_ANIMATION, normalizeQrAnimation, validQrAnimation, type QrAnimationSettings } from './qr-animation-settings';
import { reportQrAnimation } from './native-host';

export const QR_ANIMATION_KEY = 'vitani-prvaku.qr-animation';

export function bindQrAnimation(apply: (value: QrAnimationSettings) => void): () => void {
  const update = (value: QrAnimationSettings) => {
    const settings = normalizeQrAnimation(value);
    apply(settings);
    let saved = false;
    try {
      const encoded = JSON.stringify(settings);
      window.localStorage.setItem(QR_ANIMATION_KEY, encoded);
      saved = window.localStorage.getItem(QR_ANIMATION_KEY) === encoded;
    } catch { /* Live controls remain available without persistent storage. */ }
    reportQrAnimation(settings, saved);
  };
  let initial = DEFAULT_QR_ANIMATION;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(QR_ANIMATION_KEY) ?? 'null');
    if (validQrAnimation(value)) initial = value;
  } catch { /* Preserve the original choreography for corrupt settings. */ }
  update(initial);
  const receive = (event: Event) => {
    const value: unknown = (event as CustomEvent).detail;
    if (validQrAnimation(value)) update(value);
  };
  window.addEventListener('michas:qr-animation', receive);
  return () => window.removeEventListener('michas:qr-animation', receive);
}
