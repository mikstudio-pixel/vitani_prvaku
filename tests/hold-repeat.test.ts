import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HoldRepeat } from '../lib/hold-repeat';

void test('a tap changes the value once and release cancels the pending hold', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let value = 0;
  const hold = new HoldRepeat(() => { value++; });
  hold.start();
  assert.equal(value, 1);
  context.mock.timers.tick(349);
  assert.equal(value, 1);
  hold.stop();
  context.mock.timers.tick(1000);
  assert.equal(value, 1);
});

void test('holding repeats at a steady pace, stops on cancellation, and can restart', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let value = 0;
  const hold = new HoldRepeat(() => { value -= 10; });
  hold.start();
  context.mock.timers.tick(350);
  assert.equal(value, -20);
  context.mock.timers.tick(70);
  assert.equal(value, -30);
  hold.stop();
  context.mock.timers.tick(1000);
  assert.equal(value, -30);
  hold.start();
  context.mock.timers.tick(349);
  assert.equal(value, -40);
  context.mock.timers.tick(1);
  assert.equal(value, -50);
  hold.stop();
});

void test('starting again replaces the old timer instead of multiplying repeats', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let steps = 0;
  const hold = new HoldRepeat(() => { steps++; });
  hold.start();
  context.mock.timers.tick(200);
  hold.start();
  context.mock.timers.tick(150);
  assert.equal(steps, 2);
  context.mock.timers.tick(200);
  assert.equal(steps, 3);
  hold.stop();
});
