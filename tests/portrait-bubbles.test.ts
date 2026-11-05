import test from 'node:test';
import assert from 'node:assert/strict';
import { placePortraitBubble, stepPortraitBubbles, type PortraitBubble } from '../lib/portrait-bubbles';

function bubble(x: number, y: number, radius = 40, vx = 0): PortraitBubble {
  return { x, y, radius, vx, vy: 0, rise: 0, drift: 0, age: 0, held: false };
}

function assertSeparated(a: PortraitBubble, b: PortraitBubble) {
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius);
}

test('portraits exchange a gentle rebound when approaching head-on', () => {
  const a = bubble(80, 100, 40, 80);
  const b = bubble(161, 100, 40, -80);
  stepPortraitBubbles([a, b], 300, 1 / 60);
  assertSeparated(a, b);
  assert.ok(a.vx < 0 && a.vx > -40);
  assert.ok(b.vx > 0 && b.vx < 40);
});

test('a held portrait stays still and deflects an incoming portrait', () => {
  const a = bubble(80, 100, 40, 80);
  const b = { ...bubble(161, 100), held: true };
  const position = { ...b };
  stepPortraitBubbles([a, b], 300, 1 / 60);
  assert.deepEqual(b, position);
  assertSeparated(a, b);
  assert.ok(a.vx < 0);
});

test('crowded entries avoid intersecting circles even against a wall', () => {
  const width = 350;
  const height = 650;
  const bubbles: PortraitBubble[] = [];
  for (let index = 0; index < 8; index++) {
    const next = { ...bubble(80, 560, 58 + index, index * 3), rise: 22 + index * 5, drift: 20 - index * 5 };
    placePortraitBubble(next, bubbles, width, height);
    for (const other of bubbles) assertSeparated(next, other);
    bubbles.push(next);
  }
  for (let frame = 0; frame < 1200; frame++) {
    stepPortraitBubbles(bubbles, width, 1 / 60);
    for (const [index, a] of bubbles.entries()) {
      assert.ok(a.x >= a.radius && a.x <= width - a.radius);
      for (const b of bubbles.slice(index + 1)) assertSeparated(a, b);
    }
  }
  assert.ok(bubbles.every(a => a.y < height / 2), 'the cluster keeps rising');
});
