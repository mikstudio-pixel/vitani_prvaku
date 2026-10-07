import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { DeviceTilt, orientationGravity, screenTilt, type SensorState } from '../lib/device-tilt';
import type { Tilt } from '../lib/tilt';

const flat = { x: 0, y: 0 };
const close = (actual: Tilt, expected: Tilt) => {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-8, `x: ${actual.x} vs ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) < 1e-8, `y: ${actual.y} vs ${expected.y}`);
};

void test('orientation follows downhill motion in portrait and all landscape rotations', () => {
  close(screenTilt(orientationGravity(0, 18)!, flat, 0), { x: 1, y: 0 });
  close(screenTilt(orientationGravity(18, 0)!, flat, 0), { x: 0, y: 1 });
  close(screenTilt(orientationGravity(18, 0)!, flat, 90), { x: 1, y: 0 });
  close(screenTilt(orientationGravity(0, 18)!, flat, 90), { x: 0, y: -1 });
  close(screenTilt(orientationGravity(18, 0)!, flat, 270), { x: -1, y: 0 });
  close(screenTilt(orientationGravity(0, 18)!, flat, 180), { x: -1, y: 0 });
});

void test('calibration, noise rejection, missing readings and large tilts are bounded', () => {
  const rest = orientationGravity(9, -6)!;
  close(screenTilt(rest, rest, 90), flat);
  close(screenTilt(orientationGravity(0.1, -0.1)!, flat, 0), flat);
  assert.equal(orientationGravity(null, 0), null);
  assert.equal(orientationGravity(0, NaN), null);
  assert.equal(orientationGravity(Infinity, 0), null);
  const steep = screenTilt(orientationGravity(70, 80)!, flat, 0);
  assert.ok(Math.hypot(steep.x, steep.y) <= 1.0000001);
});

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
afterEach(() => {
  for (const [key, descriptor] of [['window', originalWindow], ['document', originalDocument]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function environment(permission: () => Promise<'granted' | 'denied'> = async () => 'granted', storage = new Map<string, string>()) {
  let timerId = 0;
  const timers = new Map<number, () => void>();
  const win = Object.assign(new EventTarget(), {
    isSecureContext: true,
    DeviceOrientationEvent: { requestPermission: permission },
    screen: { orientation: { angle: 0, type: 'portrait-primary' } },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    },
    setTimeout: (callback: () => void) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id: number) => { timers.delete(id); },
  });
  const doc = Object.assign(new EventTarget(), { hidden: false });
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
  const tilts: Tilt[] = [], states: SensorState[] = [];
  const controller = new DeviceTilt((value) => tilts.push(value), (state) => states.push(state));
  const reading = (beta: number | null, gamma: number | null) => {
    win.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta, gamma }));
  };
  return { win, doc, timers, tilts, states, storage, controller, reading };
}

void test('an injected Designblok host cannot bypass browser permissions or deliver motion', async () => {
  let requested = false;
  const e = environment(async () => { requested = true; return 'granted'; });
  const commands: unknown[] = [];
  Object.assign(e.win, {
    __michasNative: { paused: true, sync: { role: 'host' } },
    webkit: { messageHandlers: { michas: { postMessage: (value: unknown) => commands.push(value) } } },
  });
  await e.controller.start();
  assert.equal(requested, true);
  assert.equal(e.states.at(-1)?.phase, 'waiting');
  e.win.dispatchEvent(Object.assign(new Event('michas:motion'), { detail: { x: .5, y: .5, angle: 0 } }));
  assert.equal(e.states.at(-1)?.phase, 'waiting');
  close(e.tilts.at(-1)!, flat);
  e.reading(0, 18);
  close(e.tilts.at(-1)!, { x: 1, y: 0 });
  e.controller.dispose();
  assert.deepEqual(commands, []);
});

void test('browser starts tilted relative to horizontal and restores horizontal after sensor restart', async () => {
  const e = environment();
  await e.controller.start();
  e.reading(0, 18);
  close(e.tilts.at(-1)!, { x: 1, y: 0 });
  close(e.controller.getDiagnostics()!.neutral, flat);
  e.controller.calibrate();
  close(e.tilts.at(-1)!, flat);
  e.controller.stop();
  await e.controller.start();
  e.reading(0, 18);
  close(e.tilts.at(-1)!, { x: 1, y: 0 });
  e.reading(0, 0);
  close(e.tilts.at(-1)!, flat);
  e.controller.dispose();
});

void test('permission is requested synchronously and active status requires valid sensor data', async () => {
  let requested = false;
  const e = environment(async () => { requested = true; return 'granted'; });
  const pending = e.controller.start();
  assert.equal(requested, true);
  await pending;
  assert.equal(e.states.at(-1)?.phase, 'waiting');
  e.reading(null, null);
  assert.equal(e.states.at(-1)?.phase, 'waiting');
  e.reading(0, 0);
  assert.equal(e.states.at(-1)?.phase, 'active');
  e.reading(0, 18); close(e.tilts.at(-1)!, { x: 1, y: 0 });
  e.controller.calibrate(); close(e.tilts.at(-1)!, flat);
  e.reading(0, 18); close(e.tilts.at(-1)!, flat);
  e.controller.stop();
  const count = e.tilts.length;
  e.reading(18, 0);
  assert.equal(e.tilts.length, count);
  assert.equal(e.timers.size, 0);
});

void test('automatic mapping prefers the window angle when screen angle differs', async () => {
  const e = environment();
  // Synthetic conflicting values, not a captured reading from the user's iPad.
  Object.assign(e.win, { orientation: 90 });
  e.win.screen.orientation.angle = 0;
  await e.controller.start(); e.reading(0, 0);
  e.reading(0, -65);
  close(e.tilts.at(-1)!, { x: 0, y: 1 });
  e.controller.dispose();
});

void test('axis correction immediately rotates left to down and cycles without changing magnitude or neutral', async () => {
  const e = environment();
  await e.controller.start(); e.reading(0, 0); e.reading(0, -10);
  const initial = e.tilts.at(-1)!;
  const strength = -initial.x;
  assert.ok(strength > 0 && strength < 1);
  for (const expected of [{ x: 0, y: strength }, { x: strength, y: 0 }, { x: 0, y: -strength }, initial]) {
    e.controller.rotateAxes();
    close(e.tilts.at(-1)!, expected);
    e.reading(0, -10); close(e.tilts.at(-1)!, expected);
    close(e.controller.getDiagnostics()!.neutral, flat);
  }
  assert.equal(e.states.at(-1)!.correction, 0);
  e.controller.dispose();
});

void test('axis correction survives recalibration, sensor restart and a new app instance', async () => {
  const e = environment();
  await e.controller.start(); e.reading(0, 0); e.reading(0, -10);
  e.controller.rotateAxes(); e.controller.calibrate();
  close(e.tilts.at(-1)!, flat);
  assert.equal(e.states.at(-1)!.correction, 90);
  e.reading(0, -25);
  close(e.tilts.at(-1)!, screenTilt(orientationGravity(0, -25)!, orientationGravity(0, -10)!, 90));
  e.controller.stop(); await e.controller.start();
  e.reading(0, 0); e.reading(0, -18);
  close(e.tilts.at(-1)!, { x: 0, y: 1 });
  e.controller.dispose();
  const reopened = environment(undefined, e.storage);
  await reopened.controller.start(); reopened.reading(0, 0); reopened.reading(0, -18);
  assert.equal(reopened.states.at(-1)!.correction, 90);
  close(reopened.tilts.at(-1)!, { x: 0, y: 1 });
  reopened.controller.dispose();
});

void test('blocked storage still permits motion and reports that correction is temporary', async () => {
  const e = environment();
  Object.defineProperty(e.win, 'localStorage', { get() { throw new Error('Storage blocked'); } });
  const controller = new DeviceTilt((value) => e.tilts.push(value), (state) => e.states.push(state));
  await controller.start(); e.reading(0, 0); e.reading(0, -18);
  controller.rotateAxes();
  close(e.tilts.at(-1)!, { x: 0, y: 1 });
  assert.match(e.states.at(-1)!.message, /jen do zavření aplikace/);
  controller.dispose();
});

void test('invalid stored corrections fall back to automatic mapping', async () => {
  for (const value of ['NaN', '45', '-90', '360']) {
    const e = environment(undefined, new Map([['vitani-prvaku.sensor-axis-correction.v1', value]]));
    await e.controller.start(); e.reading(0, 0); e.reading(0, 18);
    close(e.tilts.at(-1)!, { x: 1, y: 0 });
    assert.equal(e.states.at(-1)!.correction, 0);
    e.controller.dispose();
  }
});

void test('diagnostics describe the sample and screen mapping actually used, including recalibration', async () => {
  const e = environment();
  Object.assign(e.win, { orientation: -90 });
  Object.assign(e.win.screen.orientation, { angle: 0, type: 'landscape-primary' });
  assert.equal(e.controller.getDiagnostics(), null);
  await e.controller.start(); e.reading(0, 0); e.reading(12, 6);
  e.controller.rotateAxes();
  assert.deepEqual(e.controller.getDiagnostics(), {
    beta: 12, gamma: 6, windowAngle: -90, screenAngle: 0,
    screenType: 'landscape-primary', appliedAngle: 0, neutral: flat,
  });
  e.controller.calibrate();
  close(e.controller.getDiagnostics()!.neutral, orientationGravity(12, 6)!);
  Object.assign(e.win, { orientation: NaN });
  e.win.screen.orientation.angle = NaN;
  e.reading(4, 2);
  assert.equal(e.controller.getDiagnostics()!.windowAngle, null);
  assert.equal(e.controller.getDiagnostics()!.screenAngle, null);
  assert.equal(e.controller.getDiagnostics()!.appliedAngle, 90);
  e.controller.stop();
  assert.equal(e.controller.getDiagnostics(), null);
  e.controller.rotateAxes();
  close(e.tilts.at(-1)!, flat);
});

void test('both landscape directions and portrait remain aligned when orientation APIs disagree', async () => {
  const e = environment();
  const win = Object.assign(e.win, { orientation: -90 });
  e.win.screen.orientation.angle = 90;
  await e.controller.start(); e.reading(0, 0);
  e.reading(0, 65); close(e.tilts.at(-1)!, { x: 0, y: 1 });
  win.orientation = 0;
  e.reading(65, 0); close(e.tilts.at(-1)!, { x: 0, y: 1 });
  e.controller.dispose();
});

void test('screen orientation remains the fallback when the window angle is unavailable', async () => {
  const e = environment();
  e.win.screen.orientation.angle = 270;
  await e.controller.start(); e.reading(0, 0);
  e.reading(0, 65); close(e.tilts.at(-1)!, { x: 0, y: 1 });
  e.controller.dispose();
});

void test('denied permissions leave manual control available', async () => {
  const e = environment(async () => 'denied');
  await e.controller.start();
  assert.equal(e.states.at(-1)?.phase, 'error');
  e.reading(0, 18);
  close(e.tilts.at(-1)!, flat);
  assert.equal(e.timers.size, 0);
});

void test('leaving sensor mode while permission is pending cannot re-enable it', async () => {
  let grant!: (value: 'granted') => void;
  const e = environment(() => new Promise((resolve) => { grant = resolve; }));
  const pending = e.controller.start();
  e.controller.stop(); grant('granted'); await pending;
  e.reading(0, 18);
  assert.equal(e.states.at(-1)?.phase, 'off');
  assert.equal(e.timers.size, 0);
});

void test('hidden pages neutralize tilt and resume only after a fresh reading', async () => {
  const e = environment();
  await e.controller.start(); e.reading(0, 0); e.reading(0, 18);
  e.doc.hidden = true; e.doc.dispatchEvent(new Event('visibilitychange'));
  close(e.tilts.at(-1)!, flat);
  e.reading(0, 18); close(e.tilts.at(-1)!, flat);
  assert.equal(e.states.at(-1)?.phase, 'paused');
  e.doc.hidden = false; e.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(e.states.at(-1)?.phase, 'waiting');
  e.reading(0, 18); close(e.tilts.at(-1)!, { x: 1, y: 0 });
  assert.equal(e.states.at(-1)?.phase, 'active');
  e.controller.dispose();
});

void test('a device exposing the API without readings times out and detaches', async () => {
  const e = environment();
  await e.controller.start();
  for (const timeout of e.timers.values()) timeout();
  assert.equal(e.states.at(-1)?.phase, 'error');
  const count = e.tilts.length;
  e.reading(0, 18);
  assert.equal(e.tilts.length, count);
});

void test('insecure pages do not request permission', async () => {
  let requested = false;
  const e = environment(async () => { requested = true; return 'granted'; });
  e.win.isSecureContext = false;
  await e.controller.start();
  assert.equal(requested, false);
  assert.equal(e.states.at(-1)?.phase, 'error');
});
