import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { applyIntroSettings, countdownDuration, countdownFrame, DEFAULT_INTRO, INTRO_PARAMETERS, panelSeconds, validIntroSettings } from '../lib/intro-parameters';
import { bindIntroSettings, INTRO_SETTINGS_KEY } from '../lib/intro-settings';
import { INTRO, panelsDuration } from '../lib/intro-animation';
import { MixingScenario, SCENARIO } from '../lib/mixing-scenario';
import { MixingIndicator } from '../lib/mixing-indicator';
import { ringLights } from '../lib/tilt-light';
import { WakeIntro, WAKE } from '../lib/wake-intro';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
afterEach(() => {
  applyIntroSettings(DEFAULT_INTRO);
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});

void test('editable timing bounds validate browser settings and preserve the panel clock', () => {
  for (const field of INTRO_PARAMETERS) {
    assert.ok(field.min <= DEFAULT_INTRO[field.key]);
    assert.ok(DEFAULT_INTRO[field.key] <= field.max);
  }
  assert.ok(validIntroSettings(DEFAULT_INTRO));
  for (const value of [{}, { ...DEFAULT_INTRO, extra: 1 }, { ...DEFAULT_INTRO, 'story.detected': Infinity },
    { ...DEFAULT_INTRO, 'ring.blink.count': 1.5 }, { ...DEFAULT_INTRO, 'panels.color.delay': 5 },
    { ...DEFAULT_INTRO, 'countdown.1.duration': 0 }]) assert.equal(validIntroSettings(value), false);
  assert.equal(panelSeconds(DEFAULT_INTRO), panelsDuration());
});

void test('custom numeral durations and gaps drive the caption, circle and physics together', () => {
  const value = { ...DEFAULT_INTRO, 'countdown.3.duration': .3, 'countdown.3.gapAfter': .2,
    'countdown.2.duration': .4, 'countdown.1.duration': .5, 'countdown.1.gapAfter': .1,
    'story.detected': 0, 'story.authorized': 0, 'story.decision': 0 };
  applyIntroSettings(value);
  assert.equal(countdownDuration(), 1.5);
  assert.deepEqual(countdownFrame(.4), { number: null, progress: 1, start: false });
  assert.equal(countdownFrame(.6).number, 2);
  assert.equal(countdownFrame(1.499).start, false);
  assert.equal(countdownFrame(1.5).start, true);
  const dark = ringLights({ stage: 'complete', elapsed: 0, progress: 1 }, { direction: 0, strength: 1 }, { stage: 'countdown', elapsed: .4 });
  assert.equal(dark.light, 0);
  const indicator = new MixingIndicator();
  let now = 0;
  const step = () => indicator.step(now += .01, { phase: 'ready', tiltX: 0, tiltY: 0, activity: 0, oil: 0, elapsed: now, mixed: 0 });
  while (indicator.storyFrame.stage !== 'countdown') step();
  let sawGap = false, sawStart = false;
  while (indicator.storyFrame.stage === 'countdown') {
    const frame = step(), clock = countdownFrame(indicator.storyFrame.elapsed);
    if (!clock.number && !clock.start) { sawGap = true; assert.equal(frame.prompt, undefined); assert.equal(indicator.physicsPaused, true); }
    if (frame.prompt === 'start') { sawStart = true; assert.equal(indicator.physicsPaused, false); }
  }
  assert.ok(sawGap && sawStart);
});

void test('opening question stays through the entire center-only and side-panel phases before ready', () => {
  applyIntroSettings({ ...DEFAULT_INTRO, 'story.detected': 2, 'story.authorized': 3, 'story.decision': 0 });
  const indicator = new MixingIndicator(), wake = new WakeIntro();
  wake.start(0);
  const state = { phase: 'introducing' as const, tiltX: 0, tiltY: 0, activity: 1, oil: 0, elapsed: 0, mixed: 1 };
  const readyAt = WAKE.orbit + WAKE.panels;
  for (let t = 0; t < readyAt; t += .05) {
    assert.equal(indicator.step(t, state, wake.frame(t)).prompt, 'detected');
    assert.equal(indicator.storyFrame.stage, t < WAKE.orbit ? 'detected' : 'panels');
    assert.equal(indicator.physicsPaused, true);
  }
  assert.equal(indicator.step(readyAt, state, wake.frame(readyAt)).prompt, 'ready');
  assert.equal(indicator.physicsPaused, true);
});

void test('zero center-only time still lights the side panels before the full ready hold and countdown', () => {
  applyIntroSettings({ ...DEFAULT_INTRO, 'story.detected': 0, 'story.authorized': 3, 'story.decision': 0 });
  const indicator = new MixingIndicator(), wake = new WakeIntro();
  wake.start(0);
  const state = { phase: 'introducing' as const, tiltX: 0, tiltY: 0, activity: 0, oil: 0, elapsed: 0, mixed: null };
  assert.equal(indicator.step(0, state, wake.frame(0)).prompt, 'detected');
  const readyAt = WAKE.panels;
  for (let t = .05; t < readyAt; t += .05) {
    assert.equal(indicator.step(t, state, wake.frame(t)).prompt, 'detected');
    assert.equal(indicator.physicsPaused, true);
  }
  assert.equal(indicator.step(readyAt, state, wake.frame(readyAt)).prompt, 'ready');
  for (let t = .05; t < 3; t += .05) {
    assert.equal(indicator.step(readyAt + t, state, wake.frame(readyAt + t)).prompt, 'ready');
  }
  assert.equal(indicator.step(readyAt + 3.01, state, wake.frame(readyAt + 3.01)).prompt, '3');
  assert.equal(indicator.physicsPaused, true);
});

void test('zero confirmation delays cannot manufacture lift, motion or success', () => {
  applyIntroSettings({ ...DEFAULT_INTRO, 'story.liftSeconds': 0, 'story.mixingConfirmation': 0,
    'story.successHold': 0, 'story.analysis': 0, 'story.detected': 0, 'story.authorized': 0, 'story.decision': 0 });
  const machine = new MixingScenario(), sample = { gyro: null, activity: 0, mixed: 1, receivedAt: 0 };
  assert.equal(machine.step(0, sample).stage, 'standby');
  machine.beginAfterWake();
  for (let t = 0; t < 5; t += .1) assert.notEqual(machine.step(t, sample).stage, 'success');
});

void test('intro settings restore, persist and stay browser-local all roles; invalid events do not apply', () => {
  const store = new Map<string, string>(), reports: unknown[] = [];
  const win = Object.assign(new EventTarget(), { localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  }, webkit: { messageHandlers: { michas: { postMessage: (value: unknown) => reports.push(value) } } } });
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
  const stop = bindIntroSettings();
  const value = { ...DEFAULT_INTRO, 'story.detected': 4.2, 'panels.color.duration': .8 };
  const send = (detail: unknown) => win.dispatchEvent(Object.assign(new Event('michas:intro-settings', { cancelable: true }), { detail }));
  assert.equal(send(value), false);
  assert.equal(SCENARIO.detected, 4.2);
  assert.equal(INTRO.panels.color.duration, .8);
  assert.deepEqual(reports, []);
  assert.equal(store.get(INTRO_SETTINGS_KEY), JSON.stringify(value));
  assert.equal(send({ ...value, 'story.detected': -1 }), true);
  assert.equal(SCENARIO.detected, 4.2);
  stop(); applyIntroSettings(DEFAULT_INTRO);
  const stopAgain = bindIntroSettings();
  assert.equal(SCENARIO.detected, 4.2);
  stopAgain();
  assert.equal(send(DEFAULT_INTRO), true);
});

void test('legacy settings migrate 95 to 90 once while retaining choreography and custom thresholds', () => {
  for (const threshold of [0.95, 0.87]) {
    const legacy = { ...DEFAULT_INTRO, 'story.successMixed': threshold, 'story.detected': 4.2 };
    const store = new Map([['vitani-prvaku.intro-settings.v1', JSON.stringify(legacy)]]);
    const win = Object.assign(new EventTarget(), { localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    } });
    Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
    const stop = bindIntroSettings();
    assert.equal(SCENARIO.successMixed, threshold === 0.95 ? 0.9 : threshold);
    assert.equal(SCENARIO.detected, 4.2);
    stop();
    // An explicit later choice of 95% is retained across application restarts.
    store.set(INTRO_SETTINGS_KEY, JSON.stringify({ ...legacy, 'story.successMixed': 0.95 }));
    const stopAgain = bindIntroSettings();
    assert.equal(SCENARIO.successMixed, 0.95);
    stopAgain();
  }
});

void test('existing thirty-second retry migrates once to fifteen while preserving custom settings', () => {
  const old = { ...DEFAULT_INTRO, 'story.retry': 30, 'story.detected': 4.2, 'story.successMixed': .87 };
  const store = new Map([['vitani-prvaku.intro-settings.v2', JSON.stringify(old)]]);
  const win = Object.assign(new EventTarget(), { localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  } });
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
  bindIntroSettings()();
  assert.equal(SCENARIO.retry, 15);
  assert.equal(SCENARIO.detected, 4.2);
  assert.equal(SCENARIO.successMixed, .87);
  store.set(INTRO_SETTINGS_KEY, JSON.stringify({ ...old, 'story.retry': 12 }));
  bindIntroSettings()();
  assert.equal(SCENARIO.retry, 12, 'Later edits are preserved');
});

void test('scenario snapshots distinguish all countdown gaps from the start instruction', () => {
  applyIntroSettings({ ...DEFAULT_INTRO, 'story.authorized': 0, 'story.decision': 0,
    'countdown.3.duration': .1, 'countdown.3.gapAfter': .2,
    'countdown.2.duration': .1, 'countdown.2.gapAfter': .2,
    'countdown.1.duration': .1, 'countdown.1.gapAfter': .2 });
  const machine = new MixingScenario();
  machine.beginAfterWake({ skipIntro: true });
  const sample = { gyro: null, activity: 0, receivedAt: 0 };
  machine.step(0, sample);
  for (const [time, number, start] of [[.01, 3, false], [.15, 0, false], [.31, 2, false],
    [.45, 0, false], [.61, 1, false], [.75, 0, false], [.91, 0, true]] as const) {
    const snapshot = machine.step(time, sample);
    assert.equal(snapshot.stage, 'countdown');
    assert.equal(snapshot.countdown, number);
    assert.equal(snapshot.countdownStart, start);
  }
});
