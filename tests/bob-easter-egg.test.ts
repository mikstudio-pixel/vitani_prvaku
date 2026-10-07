import assert from 'node:assert/strict';
import test from 'node:test';
import { BobGesture, BOB_SECONDS } from '../lib/bob-easter-egg';
import type { Tilt } from '../lib/tilt';

function gesture(path: (time: number) => Tilt, seconds = 6, hz = 60) {
  const detector = new BobGesture(), triggers: number[] = [];
  for (let i = 0; i < seconds * hz; i++) if (detector.step(i / hz, path(i / hz))) triggers.push(i / hz);
  return triggers;
}
const rocking = (time: number): Tilt => ({ x: 0.6 * Math.sin(time * Math.PI * 2), y: 0.02 * Math.sin(time * 5) });

void test('three seconds of left/right rocking trigger once at different frame rates', () => {
  for (const hz of [10, 20, 30, 60, 120]) {
    const triggers = gesture(rocking, 10, hz);
    assert.equal(triggers.length, 1);
    assert.ok(triggers[0] >= 3 && triggers[0] < 3.2, String(triggers[0]));
  }
});

void test('gentle rocking works with a tilted or off-center grip and natural wobble', () => {
  for (const path of [
    (t: number) => ({ x: .23 * Math.sin(t * 4.2), y: .03 * Math.sin(t * 2.1) }),
    (t: number) => ({ x: .4 + .23 * Math.sin(t * 4.2), y: .3 + .03 * Math.sin(t * 2.1) }),
    (t: number) => ({ x: .5 * Math.sin(t * 4.2), y: .12 * Math.sin(t * 2.1) }),
    (t: number) => ({ x: .4 * Math.sin(t * 2.5), y: .07 * Math.sin(t * 3.7) }),
  ]) {
    const triggers = gesture(path);
    assert.equal(triggers.length, 1);
    assert.ok(triggers[0] >= 3 && triggers[0] < 4.5, String(triggers[0]));
  }
});

void test('circles in either direction, diagonal rocking and forward/back rocking do not trigger', () => {
  for (const direction of [-1, 1]) assert.deepEqual(gesture(t => ({ x: 0.6 * Math.sin(t * 6), y: direction * 0.6 * Math.cos(t * 6) })), []);
  assert.deepEqual(gesture(t => ({ x: 0.6 * Math.sin(t * 6), y: 0.4 * Math.sin(t * 6) })), []);
  assert.deepEqual(gesture(t => ({ x: 0, y: 0.7 * Math.sin(t * 6) })), []);
  assert.deepEqual(gesture(t => ({ x: .4 + .23 * Math.sin(t * 6), y: .3 + .23 * Math.cos(t * 6) })), []);
  assert.deepEqual(gesture(t => ({ x: .6 * Math.sin(t * 6), y: .45 * Math.sin(t * 12) })), []);
});

void test('held tilt, noise, a short gesture and slow isolated swings do not trigger', () => {
  assert.deepEqual(gesture(() => ({ x: 0.7, y: 0 })), []);
  assert.deepEqual(gesture(t => ({ x: 0.08 * Math.sin(t * 31), y: 0.02 * Math.cos(t * 17) })), []);
  assert.deepEqual(gesture(rocking, 2.9), []);
  assert.deepEqual(gesture(t => ({ x: 0.6 * Math.sin(t), y: 0 })), []);
});

void test('brief but repeated swings require enough direction changes', () => {
  assert.deepEqual(gesture(t => ({ x: t < 1 ? -.6 : .6, y: 0 })), []);
});

void test('an interrupted stream, invalid sample and reset discard partial gestures', () => {
  for (const interrupt of ['gap', 'invalid', 'reset']) {
    const detector = new BobGesture();
    for (let i = 0; i < 150; i++) assert.equal(detector.step(i / 60, rocking(i / 60)), false);
    if (interrupt === 'invalid') detector.step(2.5, { x: NaN, y: 0 });
    if (interrupt === 'reset') detector.reset();
    const start = interrupt === 'gap' ? 4 : 2.6;
    for (let i = 0; i < 120; i++) assert.equal(detector.step(start + i / 60, rocking(i / 60)), false);
  }
});

void test('continuing to rock allows a later repeat only after the image and cooldown', () => {
  const triggers = gesture(rocking, 25);
  assert.ok(triggers.length >= 2);
  assert.ok(triggers[1] - triggers[0] >= BOB_SECONDS + 6);
});
