import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FrameLoop } from '../lib/frame-loop';

function harness(fps = 30) {
  const callbacks = new Map<number, FrameRequestCallback>();
  const steps: number[] = [];
  let id = 0;
  const loop = new FrameLoop(seconds => steps.push(seconds), fps,
    callback => { callbacks.set(++id, callback); return id; },
    frame => { callbacks.delete(frame); });
  const tick = (time: number) => {
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach(callback => callback(time));
  };
  return { loop, callbacks, steps, tick };
}

void test('sleep cancels all callbacks and wake never catches up sleeping time', () => {
  const h = harness();
  h.loop.setEnabled(true); h.tick(0); h.tick(34);
  assert.equal(h.steps.length, 1);
  h.loop.setEnabled(false);
  assert.equal(h.callbacks.size, 0);
  h.tick(100_000);
  assert.equal(h.steps.length, 1);
  h.loop.setEnabled(true); h.loop.setEnabled(true);
  assert.equal(h.callbacks.size, 1);
  h.tick(100_001);
  assert.equal(h.steps.length, 1);
  h.tick(100_035);
  assert.equal(h.steps.length, 2);
  assert.ok(h.steps.every(step => step <= 1 / 30));
});

void test('30, 40 and 60 FPS cadences preserve elapsed time on 60 and 120 Hz displays', () => {
  for (const fps of [30, 40, 60]) for (const refreshRate of [60, 120]) {
    const h = harness(fps);
    h.loop.setEnabled(true);
    for (let frame = 0; frame <= refreshRate; frame++) h.tick(frame * 1000 / refreshRate);
    assert.equal(h.steps.length, fps);
    assert.ok(Math.abs(h.steps.reduce((sum, step) => sum + step, 0) - 1) < 0.001);
  }
});

void test('pausing inside an advance does not schedule a replacement callback', () => {
  let callback: FrameRequestCallback = () => {};
  let requests = 0;
  const loop = new FrameLoop(() => loop.setEnabled(false), 30,
    next => { callback = next; return ++requests; }, () => {});
  loop.setEnabled(true); callback(0); callback(34);
  assert.equal(requests, 2);
  assert.equal(loop.running, false);
});

void test('small callback delays do not accumulate into a lower frame rate', () => {
  const h = harness(); h.loop.setEnabled(true);
  for (let frame = 0; frame <= 600; frame++) {
    h.tick(frame * 1000 / 60 + (frame % 4 === 2 ? 2 : 0));
  }
  assert.equal(h.steps.length, 300);
  assert.ok(h.steps.every(step => step > 0 && step <= 1 / 30));
});

void test('changing the live FPS limit keeps one callback and preserves time at both rates', () => {
  const h = harness(60); h.loop.setEnabled(true);
  for (let frame = 0; frame <= 60; frame++) h.tick(frame * 1000 / 60);
  assert.equal(h.steps.length, 60);
  h.loop.setFrameRate(30);
  assert.equal(h.callbacks.size, 1);
  for (let frame = 61; frame <= 120; frame++) h.tick(frame * 1000 / 60);
  assert.equal(h.steps.length, 90);
  h.loop.setFrameRate(60);
  for (let frame = 121; frame <= 180; frame++) h.tick(frame * 1000 / 60);
  assert.equal(h.steps.length, 150);
  assert.ok(Math.abs(h.steps.reduce((sum, step) => sum + step, 0) - 3) < 0.001);
  h.loop.setEnabled(false); h.loop.setFrameRate(30);
  assert.equal(h.callbacks.size, 0, 'changing FPS must not wake a sleeping loop');
  h.loop.setEnabled(true); h.tick(100_000); h.tick(100_034);
  assert.equal(h.steps.length, 151);
});

void test('a stalled callback skips missed deadlines without a catch-up burst', () => {
  const h = harness(); h.loop.setEnabled(true);
  h.tick(0); h.tick(1000); h.tick(1001); h.tick(1016);
  assert.equal(h.steps.length, 1);
  assert.equal(h.steps[0], 1 / 30);
  h.tick(1034);
  assert.equal(h.steps.length, 2);
});
