import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { bindFrameRate, FRAME_RATE_KEY } from '../lib/frame-rate-settings';
import { slowFrameRate, validFrameRate } from '../lib/frame-rate';

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
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } },
  });
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
  const receive = (detail: unknown) => win.dispatchEvent(Object.assign(new Event('michas:frame-rate'), { detail }));
  return { win, reports, applied, storage, receive, bind: () => bindFrameRate(value => applied.push(value)) };
}

void test('FPS limits preserve stability bounds and adaptive quality respects intentional 30 FPS', () => {
  for (const value of [30, 40, 60]) assert.equal(validFrameRate(value), true);
  for (const value of [null, {}, '30', NaN, Infinity, -1, 0, 20, 30.5, 120]) assert.equal(validFrameRate(value), false);
  assert.equal(slowFrameRate(30, 30), false); assert.equal(slowFrameRate(29, 30), false);
  assert.equal(slowFrameRate(24, 30), true); assert.equal(slowFrameRate(49, 60), true);
  assert.equal(slowFrameRate(40, 40), false); assert.equal(slowFrameRate(32, 40), true);
});
void test('FPS changes apply, persist and stay browser-local without waking; dispose removes the listener', () => {
  const e = environment(); const stop = e.bind();
  assert.deepEqual(e.applied, [60]);
  e.receive(30);
  assert.deepEqual(e.reports, []);
  assert.equal(e.storage.get(FRAME_RATE_KEY), '30');
  assert.equal(e.win.__michasNative.paused, true);
  for (const value of ['30', null, 20, 0, NaN, 120]) e.receive(value);
  assert.deepEqual(e.applied, [60, 30]);
  stop(); e.receive(60); assert.equal(e.applied.at(-1), 30);
  const restored = e.bind(); assert.equal(e.applied.at(-1), 30); restored();
});
void test('FPS settings recover corrupt storage and report temporary changes when storage is blocked', () => {
  const e = environment(new Map([[FRAME_RATE_KEY, '20']])); const stop = e.bind();
  assert.equal(e.applied[0], 60);
  Object.defineProperty(e.win, 'localStorage', { get() { throw new Error('Blocked'); } });
  e.receive(30);
  assert.deepEqual(e.reports, []); stop();
});
void test('side displays do not advertise control of the central frame rate', () => {
  const e = environment(new Map(), 'right'); const stop = e.bind();
  assert.deepEqual(e.reports, []); stop();
});
