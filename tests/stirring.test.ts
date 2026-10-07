import assert from 'node:assert/strict';
import test from 'node:test';
import { smoothTilt, stepStirring, type Tilt } from '../lib/tilt';
import { separationReadiness } from '../lib/emulsion';

function gesture(path: (time: number) => Tilt, seconds = 4, hz = 60, sensitivity = 1) {
  let tilt: Tilt = { x: 0, y: 0 }, drive = 0;
  for (let i = 0; i < seconds * hz; i++) {
    const next = smoothTilt(tilt, path(i / hz), 1 / hz);
    drive = stepStirring(drive, tilt, next, 1 / hz, sensitivity); tilt = next;
  }
  return { drive, tilt };
}

void test('clockwise and counterclockwise tray circles generate opposite GPU torque', () => {
  const clockwise = gesture(t => ({ x: .8 * Math.cos(t * 2.4), y: .8 * Math.sin(t * 2.4) }));
  const counterclockwise = gesture(t => ({ x: .8 * Math.cos(t * 2.4), y: -.8 * Math.sin(t * 2.4) }));
  assert.ok(clockwise.drive < -1 && counterclockwise.drive > 1);
  assert.ok(Math.abs(clockwise.drive + counterclockwise.drive) < 1e-12);
});

void test('held tilt and linear rocking do not create a motor', () => {
  assert.equal(gesture(() => ({ x: .7, y: .4 })).drive, 0);
  assert.equal(gesture(t => ({ x: .6 * Math.sin(t * 3), y: .3 * Math.sin(t * 3) })).drive, 0);
});

void test('torque decays at rest and reverses smoothly', () => {
  const { tilt } = gesture(t => ({ x: .8 * Math.cos(t * 2.4), y: .8 * Math.sin(t * 2.4) }));
  let drive = -1.4;
  for (let i = 0; i < 6 * 60; i++) drive = stepStirring(drive, tilt, tilt, 1 / 60);
  assert.ok(Math.abs(drive) < .0002);
  const next = stepStirring(-1.4, { x: .8, y: 0 }, { x: .8, y: -.04 }, 1 / 60);
  assert.ok(next > -1.4 && next < 0);
});

void test('a circular gesture spins up promptly without sustaining torque at rest', () => {
  // A constant swept-area rate of 1.02 gives a target drive of 1.
  let drive = 0;
  for (let i = 0; i < 12; i++) drive = stepStirring(drive, { x: 1, y: 0 }, { x: 1, y: -1.02 / 60 }, 1 / 60);
  assert.ok(drive > .63 && drive < .64);
  const released = stepStirring(drive, { x: 1, y: 0 }, { x: 1, y: 0 }, .65);
  assert.ok(Math.abs(released / drive - Math.exp(-1)) < 1e-12);
});

void test('same gesture is consistent across sensor/frame rates', () => {
  const path = (t: number) => ({ x: .8 * Math.cos(t * 2.4), y: .8 * Math.sin(t * 2.4) });
  const slow = gesture(path, 4, 30).drive, fast = gesture(path, 4, 120).drive;
  assert.ok(Math.abs(slow / fast - 1) < .015);
});

void test('small hand movements around a held tilt leave recovery fully active', () => {
  let tilt: Tilt = { x: .55, y: .18 }, drive = 0;
  for (let i = 0; i < 10 * 60; i++) {
    const t = i / 60;
    const next = smoothTilt(tilt, { x: .55 + .07 * Math.sin(t * 19), y: .18 + .06 * Math.sin(t * 31 + .7) }, 1 / 60);
    drive = stepStirring(drive, tilt, next, 1 / 60); tilt = next;
    assert.equal(separationReadiness(drive), 1);
  }
});

void test('intentional circular stirring suppresses recovery smoothly in both directions', () => {
  assert.equal(separationReadiness(0), 1);
  assert.ok(separationReadiness(.6) > .5);
  assert.ok(separationReadiness(.6) < 1);
  assert.equal(separationReadiness(.6), separationReadiness(-.6));
  assert.equal(separationReadiness(2), 0);
  assert.equal(separationReadiness(-2), 0);
});

void test('sensitivity scales gentle stirring without changing the default or maximum drive', () => {
  const path = (t: number) => ({ x: .4 * Math.cos(t * 2.4), y: .4 * Math.sin(t * 2.4) });
  const original = gesture(path).drive;
  assert.equal(gesture(path, 4, 60, 1).drive, original);
  for (const sensitivity of [.25, 1, 3, 5]) {
    const drive = gesture(path, 4, 60, sensitivity).drive;
    assert.ok(Math.abs(drive / original - sensitivity) < 1e-12);
    assert.ok(Math.abs(gesture(path, 4, 30, sensitivity).drive / gesture(path, 4, 120, sensitivity).drive - 1) < .02);
    const strong = gesture(t => ({ x: Math.cos(t * 8), y: Math.sin(t * 8) }), 4, 60, sensitivity);
    assert.ok(Math.abs(strong.drive) <= 2);
    assert.equal(gesture(() => ({ x: .7, y: .4 }), 4, 60, sensitivity).drive, 0);
    assert.equal(gesture(t => ({ x: .6 * Math.sin(t * 3), y: .3 * Math.sin(t * 3) }), 4, 60, sensitivity).drive, 0);
    assert.equal(stepStirring(0, { x: .5, y: 0 }, { x: .5, y: -.0005 }, 1 / 60, sensitivity), 0);
  }
});
