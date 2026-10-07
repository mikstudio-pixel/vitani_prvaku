import { MIXING_SENSITIVITY, normalizeMixingSensitivity, validMixingSensitivity } from './mixing-sensitivity';
import { reportMixingSensitivity } from './native-host';

export const MIXING_SENSITIVITY_KEY = 'vitani-prvaku.mixing-sensitivity';

export function bindMixingSensitivity(apply: (value: number) => void): () => void {
  const update = (value: number) => {
    const sensitivity = normalizeMixingSensitivity(value);
    apply(sensitivity);
    let saved = false;
    try {
      window.localStorage.setItem(MIXING_SENSITIVITY_KEY, String(sensitivity));
      saved = window.localStorage.getItem(MIXING_SENSITIVITY_KEY) === String(sensitivity);
    } catch { /* Keep the live setting when storage is unavailable. */ }
    reportMixingSensitivity(sensitivity, saved);
  };
  let initial: number = MIXING_SENSITIVITY.default;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(MIXING_SENSITIVITY_KEY) ?? 'null');
    if (validMixingSensitivity(value)) initial = value;
  } catch { /* Missing or corrupt settings use the original response. */ }
  update(initial);
  const receive = (event: Event) => {
    const value: unknown = (event as CustomEvent).detail;
    if (validMixingSensitivity(value)) update(value);
  };
  window.addEventListener('michas:mixing-sensitivity', receive);
  return () => window.removeEventListener('michas:mixing-sensitivity', receive);
}
