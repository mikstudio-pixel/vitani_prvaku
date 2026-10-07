import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { bindQrAnimation, QR_ANIMATION_KEY } from '../lib/qr-settings';
import { DEFAULT_QR_ANIMATION, QR_ANIMATION_LIMITS, normalizeQrAnimation, validQrAnimation } from '../lib/qr-animation-settings';
import { MixingScenario, SCENARIO } from '../lib/mixing-scenario';

import { applyIntroSettings, DEFAULT_INTRO } from '../lib/intro-parameters';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});
function environment(stored?: string, role = 'host') {
  const storage = new Map<string, string>(stored === undefined ? [] : [[QR_ANIMATION_KEY, stored]]);
  const reports: unknown[] = [], applied: unknown[] = [];
  const win = Object.assign(new EventTarget(), {
    __michasNative: { paused: true, sync: { role } },
    webkit: { messageHandlers: { michas: { postMessage: (value: unknown) => reports.push(value) } } },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    },
  });
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
  return { win, storage, reports, applied,
    receive: (detail: unknown) => win.dispatchEvent(Object.assign(new Event('vitani-prvaku:qr-animation'), { detail })),
    bind: () => bindQrAnimation(value => applied.push(value)),
  };
}

void test('QR timing validates both controls and finishes before the story can release it', () => {
  assert.deepEqual(DEFAULT_QR_ANIMATION, { revealSeconds: 20, disperseSpeed: 1 });
  assert.ok(QR_ANIMATION_LIMITS.revealMax <= SCENARIO.restart);
  for (const value of [null, {}, { revealSeconds: '20', disperseSpeed: 1 }, { revealSeconds: 4.999, disperseSpeed: 1 },
    { revealSeconds: 20.001, disperseSpeed: 1 }, { revealSeconds: 20, disperseSpeed: .249 },
    { revealSeconds: 20, disperseSpeed: 3.001 }, { revealSeconds: Infinity, disperseSpeed: 1 }, { revealSeconds: 20, disperseSpeed: NaN }]) {
    assert.equal(validQrAnimation(value), false);
  }
  assert.equal(validQrAnimation({ revealSeconds: 5, disperseSpeed: .25 }), true);
  assert.equal(validQrAnimation({ revealSeconds: 20, disperseSpeed: 3 }), true);
  assert.deepEqual(normalizeQrAnimation({ revealSeconds: 12.1234, disperseSpeed: 1.2345 }), { revealSeconds: 12.123, disperseSpeed: 1.235 });
});

void test('QR controls apply atomically, persist, restore and stay browser-local without waking', () => {
  const e = environment(), stop = e.bind();
  assert.deepEqual(e.applied, [DEFAULT_QR_ANIMATION]);
  const settings = { revealSeconds: 8, disperseSpeed: 2.5 };
  e.receive(settings);
  assert.deepEqual(e.applied.at(-1), settings);
  assert.equal(e.storage.get(QR_ANIMATION_KEY), JSON.stringify(settings));
  assert.deepEqual(e.reports, []);
  assert.equal(e.win.__michasNative.paused, true);
  for (const value of [null, 2, {}, { revealSeconds: 1, disperseSpeed: 1 }]) e.receive(value);
  assert.equal(e.applied.length, 2);
  stop(); e.receive(DEFAULT_QR_ANIMATION);
  assert.equal(e.applied.length, 2);
  const unbind = e.bind();
  assert.deepEqual(e.applied.at(-1), settings); unbind();
});

void test('QR settings survive corrupt storage with defaults and report blocked storage', () => {
  for (const stored of ['{', 'null', '{}', '{"revealSeconds":0,"disperseSpeed":1}']) {
    const e = environment(stored), stop = e.bind();
    assert.deepEqual(e.applied, [DEFAULT_QR_ANIMATION]); stop();
  }
  const e = environment();
  Object.defineProperty(e.win, 'localStorage', { get() { throw new Error('Blocked'); } });
  const stop = e.bind(), value = { revealSeconds: 30, disperseSpeed: .25 };
  e.receive(value);
  assert.deepEqual(e.reports, []); stop();
});

void test('side previews never advertise QR control support on the host behalf', () => {
  const e = environment(undefined, 'left'), stop = e.bind();
  e.receive({ revealSeconds: 5, disperseSpeed: 3 });
  assert.deepEqual(e.reports, []); stop();
});

void test('maximum browser QR duration fits the actual combined ending with zero preceding holds', () => {
  applyIntroSettings({ ...DEFAULT_INTRO, 'story.result': 0, 'story.farewell': 0,
    'story.connecting': 0, 'story.welcome': 0 });
  try {
    const scenario = new MixingScenario();
    scenario.beginAfterWake();
    let now = 0;
    const step = (activity: number) => scenario.step(now += .05,
      { gyro: null, activity, mixed: .97, quiet: activity ? 0 : 1, receivedAt: now });
    for (let i = 0; i < 1000 && scenario.snapshot().stage !== 'bon-appetit'; i++) step(.7);
    assert.equal(scenario.snapshot().stage, 'bon-appetit');
    const qrStart = now;
    for (let i = 0; i < 1000 && scenario.snapshot().stage !== 'standby'; i++) step(0);
    assert.equal(scenario.snapshot().stage, 'standby');
    assert.ok(now - qrStart >= QR_ANIMATION_LIMITS.revealMax);
    assert.ok(now - qrStart < SCENARIO.restart + .2, 'Preserve the twenty-second ending');
  } finally {
    applyIntroSettings(DEFAULT_INTRO);
  }
});
