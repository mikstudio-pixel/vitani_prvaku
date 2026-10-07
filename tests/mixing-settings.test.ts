import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { bindMixingSensitivity, MIXING_SENSITIVITY_KEY } from '../lib/mixing-settings';
import { normalizeMixingSensitivity, validMixingSensitivity } from '../lib/mixing-sensitivity';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});

function environment(storage = new Map<string, string>(), role = 'host') {
  const reports: unknown[] = [], applied: number[] = [];
  const win = Object.assign(new EventTarget(), {
    __michasNative: { paused: true, sync: { role } },
    webkit: { messageHandlers: { michas: { postMessage: (value: unknown) => reports.push(value) } } },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    },
  });
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
  const receive = (detail: unknown) => win.dispatchEvent(Object.assign(new Event('michas:mixing-sensitivity'), { detail }));
  return { win, reports, applied, storage, receive, bind: () => bindMixingSensitivity(value => applied.push(value)) };
}

void test('mixing sensitivity validates finite numeric limits and uses BLE precision', () => {
  for (const value of [.25, 1, 1.23456, 3, 4, 5]) assert.equal(validMixingSensitivity(value), true);
  assert.equal(normalizeMixingSensitivity(1.23456), 1.235);
  for (const value of [null, {}, '2', NaN, Infinity, -1, .249, 5.001]) assert.equal(validMixingSensitivity(value), false);
  assert.equal(normalizeMixingSensitivity(NaN), 1);
});

void test('settings apply, persist, stay browser-local and restore without waking or periodic work', () => {
  const e = environment();
  const dispose = e.bind();
  assert.deepEqual(e.applied, [1]);
  assert.deepEqual(e.reports, []);
  e.receive(1.75);
  assert.equal(e.applied.at(-1), 1.75);
  assert.equal(e.storage.get(MIXING_SENSITIVITY_KEY), '1.75');
  assert.deepEqual(e.reports, []);
  assert.equal(e.win.__michasNative.paused, true);
  for (const value of [undefined, null, '2', {}, 0, 6, NaN]) e.receive(value);
  assert.equal(e.applied.length, 2);
  dispose(); e.receive(2);
  assert.equal(e.applied.length, 2);
  const stop = e.bind();
  assert.equal(e.applied.at(-1), 1.75);
  stop();
});

void test('corrupt or old settings restore the original sensitivity', () => {
  for (const stored of ['bad json', 'null', '"2"', '{}', '0', '6']) {
    const e = environment(new Map([[MIXING_SENSITIVITY_KEY, stored]]));
    const stop = e.bind();
    assert.deepEqual(e.applied, [1]); stop();
  }
});

void test('blocked storage applies temporarily and keeps temporary changes browser-local', () => {
  const e = environment();
  Object.defineProperty(e.win, 'localStorage', { get() { throw new Error('Blocked'); } });
  const stop = e.bind();
  e.receive(5);
  assert.deepEqual(e.applied, [1, 5]);
  assert.deepEqual(e.reports, []);
  stop();
});

void test('side previews do not report host mixing settings', () => {
  const e = environment(new Map(), 'right');
  const stop = e.bind(); e.receive(2);
  assert.deepEqual(e.reports, []); stop();
});
