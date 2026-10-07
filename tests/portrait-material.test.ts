import assert from 'node:assert/strict';
import { test } from 'node:test';
import { portraitMaterial } from '../lib/portrait-material';
void test('portrait concentration has upright WebGL rows and separated phases', () => {
  const image = { width: 2, height: 2, data: new Uint8ClampedArray([255,255,255,255, 0,0,0,255, 0,0,0,255, 255,255,255,255]) };
  assert.deepEqual([...portraitMaterial(image, 2)], [1,0,0,1, 0,0,0,1, 0,0,0,1, 1,0,0,1]);
});
void test('a gray portrait has both unmixed phases rather than awarding false progress', () => {
  const values = portraitMaterial({ width: 1, height: 1, data: new Uint8ClampedArray([128,128,128,255]) }, 4);
  const concentration = [...values].filter((_, i) => i % 4 === 0);
  assert.equal(concentration.reduce((sum, c) => sum + c, 0), 8);
  assert.equal(concentration.every(c => c === 0 || c === 1), true);
  assert.equal([...values].filter((_, i) => i % 4 === 1).every(exposure => exposure === 0), true);
});
void test('invalid camera images are rejected', () => {
  assert.throws(() => portraitMaterial({ width: 0, height: 0, data: new Uint8ClampedArray() }, 4));
});
