import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PortraitHold } from '../lib/portrait-hold';

void test('portrait requires one continuous second and captures once until lift', () => {
  const hold = new PortraitHold(); hold.down(1, 10);
  assert.deepEqual(hold.step(509), { progress: .499, capture: false });
  assert.equal(hold.step(1009).capture, false);
  assert.deepEqual(hold.step(1010), { progress: 1, capture: true });
  assert.equal(hold.step(2000).capture, false);
  hold.up(1); hold.down(1, 2500);
  assert.equal(hold.step(3500).capture, true);
});
void test('short press, drag, cancellation and multiple fingers never take a portrait', () => {
  const hold = new PortraitHold();
  hold.down(1, 0); hold.up(1); assert.equal(hold.step(1000).capture, false);
  hold.down(1, 1000, 20, 20); hold.move(1, 50, 20); assert.equal(hold.step(2000).capture, false); hold.up(1);
  hold.down(1, 2000); hold.cancel(); assert.equal(hold.step(3000).capture, false);
  hold.down(1, 3000); hold.down(2, 3200); hold.up(2); assert.equal(hold.step(4000).capture, false); hold.up(1);
  hold.down(3, 4000); assert.equal(hold.step(5000).capture, true);
});
