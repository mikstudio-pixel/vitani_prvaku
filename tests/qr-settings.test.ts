import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { bindQrAnimation, QR_ANIMATION_KEY } from '../lib/qr-settings';
import { DEFAULT_QR_ANIMATION, QR_ANIMATION_LIMITS, normalizeQrAnimation, validQrAnimation } from '../lib/qr-animation-settings';
import { SCENARIO } from '../lib/mixing-scenario';

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
    receive: (detail: unknown) => win.dispatchEvent(Object.assign(new Event('michas:qr-animation'), { detail })),
    bind: () => bindQrAnimation(value => applied.push(value)),
  };
}

void test('QR timing validates both controls and finishes before the story can release it', () => {
  assert.deepEqual(DEFAULT_QR_ANIMATION, { revealSeconds: 20, disperseSpeed: 1 });
  assert.ok(QR_ANIMATION_LIMITS.revealMax < SCENARIO.result + SCENARIO.farewell + SCENARIO.connecting + SCENARIO.welcome);
  for (const value of [null, {}, { revealSeconds: '20', disperseSpeed: 1 }, { revealSeconds: 4.999, disperseSpeed: 1 },
    { revealSeconds: 30.001, disperseSpeed: 1 }, { revealSeconds: 20, disperseSpeed: .249 },
    { revealSeconds: 20, disperseSpeed: 3.001 }, { revealSeconds: Infinity, disperseSpeed: 1 }, { revealSeconds: 20, disperseSpeed: NaN }]) {
    assert.equal(validQrAnimation(value), false);
  }
  assert.equal(validQrAnimation({ revealSeconds: 5, disperseSpeed: .25 }), true);
  assert.equal(validQrAnimation({ revealSeconds: 30, disperseSpeed: 3 }), true);
  assert.deepEqual(normalizeQrAnimation({ revealSeconds: 12.1234, disperseSpeed: 1.2345 }), { revealSeconds: 12.123, disperseSpeed: 1.235 });
});

void test('QR controls apply atomically, persist, restore and acknowledge without waking', () => {
  const e = environment(), stop = e.bind();
  assert.deepEqual(e.applied, [DEFAULT_QR_ANIMATION]);
  const settings = { revealSeconds: 8, disperseSpeed: 2.5 };
  e.receive(settings);
  assert.deepEqual(e.applied.at(-1), settings);
  assert.equal(e.storage.get(QR_ANIMATION_KEY), JSON.stringify(settings));
  assert.deepEqual(e.reports.at(-1), { command: 'qr-settings-report', value: settings, saved: true });
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
  assert.deepEqual(e.reports.at(-1), { command: 'qr-settings-report', value, saved: false }); stop();
});

void test('side previews never advertise QR control support on the host behalf', () => {
  const e = environment(undefined, 'left'), stop = e.bind();
  e.receive({ revealSeconds: 5, disperseSpeed: 3 });
  assert.deepEqual(e.reports, []); stop();
});
