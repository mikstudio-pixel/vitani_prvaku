import { reportSoundSettings } from './native-host';

export const SOUND_LEVELS = [
  ['master', 'Celková hlasitost', .65], ['wake', 'Probuzení tácu', .42],
  ['typing', 'Psaní textu', .10], ['panels', 'Rozsvícení bočních panelů', .18],
  ['countdown', 'Odpočet', .34], ['countdown-start', 'Start míchání', .42],
  ['mixing', 'Motor míchání', .32], ['riser', 'Náběh do finále', .30],
  ['ding', 'Domícháno', .42], ['sleep', 'Uspání', .18], ['failure', 'Selhání míchání', .42],
] as const;
export type SoundLevel = typeof SOUND_LEVELS[number][0];
export type SoundSettings = Record<SoundLevel, number>;
export const DEFAULT_SOUND_SETTINGS = Object.fromEntries(SOUND_LEVELS.map(([key, , value]) => [key, value])) as SoundSettings;
export const SOUND_SETTINGS_KEY = 'vitani-prvaku.sound-settings.v1';
export function validSoundSettings(value: unknown): value is SoundSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const values = value as Record<string, unknown>;
  return Object.keys(values).length === SOUND_LEVELS.length && SOUND_LEVELS.every(([key]) =>
    typeof values[key] === 'number' && Number.isFinite(values[key]) && values[key] >= 0 && values[key] <= 1);
}
export const sameSoundSettings = (a: SoundSettings, b: SoundSettings) => SOUND_LEVELS.every(([key]) => Math.abs(a[key] - b[key]) < .00001);
export function bindSoundSettings(apply: (value: SoundSettings) => void) {
  const update = (value: SoundSettings) => {
    apply(value);
    let saved = false;
    try {
      const encoded = JSON.stringify(value);
      localStorage.setItem(SOUND_SETTINGS_KEY, encoded);
      saved = localStorage.getItem(SOUND_SETTINGS_KEY) === encoded;
    } catch { /* Live playback still changes; report failed persistence. */ }
    reportSoundSettings(value, saved);
  };
  let initial = DEFAULT_SOUND_SETTINGS;
  try { const value: unknown = JSON.parse(localStorage.getItem(SOUND_SETTINGS_KEY) ?? 'null'); if (validSoundSettings(value)) initial = value; } catch { /* Restore defaults. */ }
  update(initial);
  const receive = (event: Event) => {
    const value: unknown = (event as CustomEvent).detail;
    if (!validSoundSettings(value)) return;
    update(value); event.preventDefault();
  };
  window.addEventListener('vitani-prvaku:sound-settings', receive);
  return () => window.removeEventListener('vitani-prvaku:sound-settings', receive);
}
