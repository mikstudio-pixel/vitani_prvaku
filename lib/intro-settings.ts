import { applyIntroSettings, DEFAULT_INTRO, migrateLegacyIntroSettings, validIntroSettings, type IntroSettings } from './intro-parameters';
import { reportIntroSettings } from './native-host';

export const INTRO_SETTINGS_KEY = 'vitani-prvaku.intro-settings.v3';
export function bindIntroSettings(): () => void {
  const update = (value: IntroSettings) => {
    applyIntroSettings(value);
    let saved = false;
    try {
      const encoded = JSON.stringify(value);
      window.localStorage.setItem(INTRO_SETTINGS_KEY, encoded);
      saved = window.localStorage.getItem(INTRO_SETTINGS_KEY) === encoded;
    } catch { /* Report a persistence failure to the Mac, without losing live settings. */ }
    reportIntroSettings(value, saved);
  };
  let initial = DEFAULT_INTRO;
  try {
    const stored = window.localStorage.getItem(INTRO_SETTINGS_KEY);
    const previous = window.localStorage.getItem('vitani-prvaku.intro-settings.v2');
    const value: unknown = JSON.parse(stored ?? previous ?? window.localStorage.getItem('vitani-prvaku.intro-settings.v1') ?? 'null');
    if (validIntroSettings(value)) initial = stored !== null ? value
      : { ...(previous !== null ? value : migrateLegacyIntroSettings(value)), 'story.retry': 15 };
  } catch { /* Restore the original choreography for corrupt storage. */ }
  update(initial);
  const receive = (event: Event) => {
    const value: unknown = (event as CustomEvent).detail;
    if (!validIntroSettings(value)) return;
    update(value);
    event.preventDefault(); // Native dispatch can distinguish an accepted setting from an unsupported UI.
  };
  window.addEventListener('michas:intro-settings', receive);
  return () => window.removeEventListener('michas:intro-settings', receive);
}
