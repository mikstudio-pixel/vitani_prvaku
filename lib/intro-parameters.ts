/** Shared editable choreography; seconds unless the field says otherwise. */
export type IntroSettings = Record<string, number>;
export type IntroParameter = { key: string; group: string; label: string; value: number; unit: string; min: number; max: number; step: number };
export const INTRO_PARAMETERS: readonly IntroParameter[] = [
  {"key": "panels.color.delay", "group": "Boční panely", "label": "Návrat barev panelů · prodleva", "value": 0, "unit": "s", "min": 0, "max": 5.1, "step": 0.01},
  {"key": "panels.color.duration", "group": "Boční panely", "label": "Návrat barev panelů · trvání", "value": 0.72, "unit": "s", "min": 0, "max": 5.1, "step": 0.01},
  {"key": "panels.color.curve.0", "group": "Křivky panelů", "label": "Návrat barev panelů · Bézier x1", "value": 0.3333333333333333, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "panels.color.curve.1", "group": "Křivky panelů", "label": "Návrat barev panelů · Bézier y1", "value": 0, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "panels.color.curve.2", "group": "Křivky panelů", "label": "Návrat barev panelů · Bézier x2", "value": 0.6666666666666666, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "panels.color.curve.3", "group": "Křivky panelů", "label": "Návrat barev panelů · Bézier y2", "value": 1, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "panels.stripEntry.delay", "group": "Boční panely", "label": "Vstup modrého pásku · prodleva", "value": 0, "unit": "s", "min": 0, "max": 5.1, "step": 0.01},
  {"key": "panels.stripEntry.duration", "group": "Boční panely", "label": "Vstup modrého pásku · trvání", "value": 0.36, "unit": "s", "min": 0, "max": 5.1, "step": 0.01},
  {"key": "panels.stripEntry.curve.0", "group": "Křivky panelů", "label": "Vstup modrého pásku · Bézier x1", "value": 0.3333333333333333, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "panels.stripEntry.curve.1", "group": "Křivky panelů", "label": "Vstup modrého pásku · Bézier y1", "value": 0, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "panels.stripEntry.curve.2", "group": "Křivky panelů", "label": "Vstup modrého pásku · Bézier x2", "value": 0.6666666666666666, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "panels.stripEntry.curve.3", "group": "Křivky panelů", "label": "Vstup modrého pásku · Bézier y2", "value": 1, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "panels.stripTravel.delay", "group": "Boční panely", "label": "Cesta pásku · prodleva", "value": 0.36, "unit": "s", "min": 0, "max": 5.1, "step": 0.01},
  {"key": "panels.stripTravel.duration", "group": "Boční panely", "label": "Cesta pásku · trvání", "value": 1.92, "unit": "s", "min": 0, "max": 5.1, "step": 0.01},
  {"key": "panels.stripTravel.curve.0", "group": "Křivky panelů", "label": "Cesta pásku · Bézier x1", "value": 0.3333333333333333, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "panels.stripTravel.curve.1", "group": "Křivky panelů", "label": "Cesta pásku · Bézier y1", "value": 0, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "panels.stripTravel.curve.2", "group": "Křivky panelů", "label": "Cesta pásku · Bézier x2", "value": 0.6666666666666666, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "panels.stripTravel.curve.3", "group": "Křivky panelů", "label": "Cesta pásku · Bézier y2", "value": 1, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "panels.destinationOrbit.delay", "group": "Boční panely", "label": "Oběh značky v cíli · prodleva", "value": 0, "unit": "s", "min": 0, "max": 5.1, "step": 0.01},
  {"key": "panels.destinationOrbit.duration", "group": "Boční panely", "label": "Oběh značky v cíli · trvání", "value": 2.28, "unit": "s", "min": 0, "max": 5.1, "step": 0.01},
  {"key": "panels.destinationOrbit.curve.0", "group": "Křivky panelů", "label": "Oběh značky v cíli · Bézier x1", "value": 0.3333333333333333, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "panels.destinationOrbit.curve.1", "group": "Křivky panelů", "label": "Oběh značky v cíli · Bézier y1", "value": 0, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "panels.destinationOrbit.curve.2", "group": "Křivky panelů", "label": "Oběh značky v cíli · Bézier x2", "value": 0.6666666666666666, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "panels.destinationOrbit.curve.3", "group": "Křivky panelů", "label": "Oběh značky v cíli · Bézier y2", "value": 1, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "panels.pauseAfter", "group": "Boční panely", "label": "Pauza po animaci panelů", "value": 0.12, "unit": "s", "min": 0, "max": 5.1, "step": 0.01},
  {"key": "story.detected", "group": "Zvednutí iPadu", "label": "Mícháš nebo nemícháš? · pouze prostřední iPad", "value": 2, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "story.authorized", "group": "Nápisy a odpočet", "label": "Jsi ready? · trvání", "value": 1.2, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "story.decision", "group": "Nápisy a odpočet", "label": "Další prodleva před odpočtem (Jsi ready? zůstává)", "value": 2, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "countdown.3.duration", "group": "Nápisy a odpočet", "label": "Číslice 3 · trvání", "value": 1, "unit": "s", "min": 0.05, "max": 120, "step": 0.01},
  {"key": "countdown.3.gapAfter", "group": "Nápisy a odpočet", "label": "Pauza po číslici 3", "value": 0, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "countdown.2.duration", "group": "Nápisy a odpočet", "label": "Číslice 2 · trvání", "value": 1, "unit": "s", "min": 0.05, "max": 120, "step": 0.01},
  {"key": "countdown.2.gapAfter", "group": "Nápisy a odpočet", "label": "Pauza po číslici 2", "value": 0, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "countdown.1.duration", "group": "Nápisy a odpočet", "label": "Číslice 1 · trvání", "value": 1, "unit": "s", "min": 0.05, "max": 120, "step": 0.01},
  {"key": "countdown.1.gapAfter", "group": "Nápisy a odpočet", "label": "Pauza po číslici 1", "value": 0, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "countdown.start", "group": "Nápisy a odpočet", "label": "Míchej před analýzou", "value": 0.6, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "story.analysis", "group": "Nápisy a odpočet", "label": "Analýza (Míchej zůstává na středu)", "value": 2, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "ring.blink.count", "group": "Modrý kruh", "label": "Počet probliknutí při Míchej", "value": 2, "unit": "", "min": 0, "max": 10, "step": 1},
  {"key": "ring.blink.fadeOut", "group": "Modrý kruh", "label": "Probliknutí · pohasnutí", "value": 0.06, "unit": "s", "min": 0, "max": 5.1, "step": 0.005},
  {"key": "ring.blink.dark", "group": "Modrý kruh", "label": "Probliknutí · tma", "value": 0.035, "unit": "s", "min": 0, "max": 5.1, "step": 0.005},
  {"key": "ring.blink.fadeIn", "group": "Modrý kruh", "label": "Probliknutí · rozsvícení", "value": 0.06, "unit": "s", "min": 0, "max": 5.1, "step": 0.005},
  {"key": "ring.blink.lit", "group": "Modrý kruh", "label": "Probliknutí · svítící mezera", "value": 0.055, "unit": "s", "min": 0, "max": 5.1, "step": 0.005},
  {"key": "ring.collapse.duration", "group": "Modrý kruh", "label": "Stažení kruhu do gyroskopického bodu", "value": 0.75, "unit": "s", "min": 0, "max": 5.1, "step": 0.01},
  {"key": "ring.collapse.curve.0", "group": "Modrý kruh", "label": "Stažení · Bézier x1", "value": 0.3333333333333333, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "ring.collapse.curve.1", "group": "Modrý kruh", "label": "Stažení · Bézier y1", "value": 0, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "ring.collapse.curve.2", "group": "Modrý kruh", "label": "Stažení · Bézier x2", "value": 0.6666666666666666, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "ring.collapse.curve.3", "group": "Modrý kruh", "label": "Stažení · Bézier y2", "value": 1, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "ring.fullLight", "group": "Modrý kruh", "label": "Jas celého kruhu", "value": 0.95, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "ring.fullPeak", "group": "Modrý kruh", "label": "Intenzita záře celého kruhu", "value": 0.7, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "story.startWindow", "group": "Následné scénáře", "label": "Čas na zahájení míchání", "value": 7, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "story.pauseWindow", "group": "Následné scénáře", "label": "Čas na obnovení míchání", "value": 7, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "story.mixingConfirmation", "group": "Následné scénáře", "label": "Potvrzení souvislého míchání", "value": 0.25, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "story.secondPrompt", "group": "Následné scénáře", "label": "Prodleva před Nemícháš", "value": 3.8, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "story.idlePrompt", "group": "Následné scénáře", "label": "Klid před výzvou k pokračování", "value": 0.6, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "story.successHold", "group": "Následné scénáře", "label": "Potvrzení dokončení", "value": 0.5, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "story.result", "group": "Následné scénáře", "label": "Výsledek (úspěch / neúspěch)", "value": 1.5, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "story.farewell", "group": "Následné scénáře", "label": "Dobrou chuť", "value": 3, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "story.retry", "group": "Následné scénáře", "label": "Čekání po nezamíchání", "value": 15, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "story.connecting", "group": "Následné scénáře", "label": "Spojení", "value": 2.5, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "story.welcome", "group": "Následné scénáře", "label": "Uvítání", "value": 24, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "story.resetQuiet", "group": "Následné scénáře", "label": "Klid pro návrat do standby", "value": 8, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "story.liftSeconds", "group": "Následné scénáře", "label": "Délka potvrzení zvednutí", "value": 0.25, "unit": "s", "min": 0, "max": 120, "step": 0.01},
  {"key": "story.liftThreshold", "group": "Prahy scénáře", "label": "Práh zvednutí", "value": 0.25, "unit": "", "min": 0.01, "max": 1, "step": 0.01},
  {"key": "story.mixingThreshold", "group": "Prahy scénáře", "label": "Práh míchání", "value": 0.18, "unit": "", "min": 0.01, "max": 1, "step": 0.01},
  {"key": "story.successMixed", "group": "Prahy scénáře", "label": "Promíchání pro úspěch", "value": 0.9, "unit": "", "min": 0.01, "max": 1, "step": 0.01},
  {"key": "story.keepMixed", "group": "Prahy scénáře", "label": "Promíchání pro Míchej dál", "value": 0.5, "unit": "", "min": 0.01, "max": 1, "step": 0.01},
  {"key": "ring.sweep.curve.0", "group": "Modrý kruh", "label": "Zhasínání odpočtu · Bézier x1", "value": 0.3333333333333333, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "ring.sweep.curve.1", "group": "Modrý kruh", "label": "Zhasínání odpočtu · Bézier y1", "value": 0, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "ring.sweep.curve.2", "group": "Modrý kruh", "label": "Zhasínání odpočtu · Bézier x2", "value": 0.6666666666666666, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "ring.sweep.curve.3", "group": "Modrý kruh", "label": "Zhasínání odpočtu · Bézier y2", "value": 1, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "ring.blink.curve.0", "group": "Modrý kruh", "label": "Probliknutí · Bézier x1", "value": 0.3333333333333333, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "ring.blink.curve.1", "group": "Modrý kruh", "label": "Probliknutí · Bézier y1", "value": 0, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "ring.blink.curve.2", "group": "Modrý kruh", "label": "Probliknutí · Bézier x2", "value": 0.6666666666666666, "unit": "", "min": 0, "max": 1, "step": 0.01},
  {"key": "ring.blink.curve.3", "group": "Modrý kruh", "label": "Probliknutí · Bézier y2", "value": 1, "unit": "", "min": 0, "max": 1, "step": 0.01},
];
export const DEFAULT_INTRO: IntroSettings = Object.fromEntries(INTRO_PARAMETERS.map(field => [field.key, field.value]));
let current = { ...DEFAULT_INTRO };
export const introValue = (key: string) => current[key];
export const introCurve = (prefix: string): readonly [number, number, number, number] => [0, 1, 2, 3].map(i => introValue(`${prefix}.curve.${i}`)) as [number, number, number, number];
export const panelSeconds = (settings: IntroSettings) => Math.max(...['color', 'stripEntry', 'stripTravel', 'destinationOrbit'].map(track => settings[`panels.${track}.delay`] + settings[`panels.${track}.duration`])) + settings['panels.pauseAfter'];
export function introSettingsError(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Neplatné nastavení úvodu.';
  const settings = value as IntroSettings;
  if (Object.keys(settings).length !== INTRO_PARAMETERS.length) return 'Nastavení musí obsahovat všechny parametry.';
  for (const field of INTRO_PARAMETERS) {
    const number = settings[field.key];
    if (typeof number !== 'number' || !Number.isFinite(number) || number < field.min || number > field.max || (field.key === 'ring.blink.count' && !Number.isInteger(number))) return `${field.label}: povoleno ${field.min}–${field.max}${field.unit ? ' ' + field.unit : ''}.`;
  }
  if (panelSeconds(settings) > 5.1 + 1e-9) return 'Boční panely včetně poslední pauzy mohou trvat nejvýše 5,1 s (synchronizace Bluetooth).';
  if (settings['ring.blink.count'] > 0 && ['fadeOut', 'dark', 'fadeIn', 'lit'].every(key => settings[`ring.blink.${key}`] === 0)) return 'Probliknutí musí mít nenulové trvání.';
  return null;
}
export const validIntroSettings = (value: unknown): value is IntroSettings => introSettingsError(value) === null;
export const sameIntroSettings = (a: IntroSettings, b: IntroSettings) => INTRO_PARAMETERS.every(field => Math.abs(a[field.key] - b[field.key]) < 0.000001);
export function applyIntroSettings(value: IntroSettings) { if (!validIntroSettings(value)) return false; current = { ...value }; return true; }
export function countdownDuration() { return [3, 2, 1].reduce((sum, n) => sum + introValue(`countdown.${n}.duration`) + introValue(`countdown.${n}.gapAfter`), 0); }
/** Gaps freeze the bowl and leave the central caption and circle dark. */
export function countdownFrame(elapsed: number): { number: 3 | 2 | 1 | null; progress: number; start: boolean } {
  const time = Math.max(0, elapsed);
  let cursor = 0;
  for (const n of [3, 2, 1] as const) {
    const duration = introValue(`countdown.${n}.duration`), gap = introValue(`countdown.${n}.gapAfter`);
    if (time < cursor + duration) return { number: n, progress: (time - cursor) / duration, start: false };
    cursor += duration;
    if (time < cursor + gap) return { number: null, progress: 1, start: false };
    cursor += gap;
  }
  return { number: null, progress: 1, start: true };
}

/** One-time upgrade of the old default; preserve individually tuned values. */
export function migrateLegacyIntroSettings(value: IntroSettings): IntroSettings {
  return value['story.successMixed'] === 0.95 ? { ...value, 'story.successMixed': 0.9 } : { ...value };
}
export const MIXING_PARAMETER_KEYS = new Set([
  'story.analysis', 'story.startWindow', 'story.pauseWindow', 'story.mixingConfirmation',
  'story.secondPrompt', 'story.idlePrompt', 'story.successHold', 'story.mixingThreshold',
  'story.successMixed', 'story.keepMixed',
]);
