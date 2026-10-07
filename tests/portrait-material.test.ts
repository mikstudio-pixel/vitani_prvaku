import assert from 'node:assert/strict';
import { test } from 'node:test';
import { portraitPattern } from '../lib/portrait-material';
void test('portrait mask has upright WebGL rows and two phases', () => {
  const image = { width: 2, height: 2, data: new Uint8ClampedArray([255,255,255,255, 0,0,0,255, 0,0,0,255, 255,255,255,255]) };
  assert.deepEqual([...portraitPattern(image, 2)], [1,0,0,1]);
});
void test('threshold adapts to low light without adding halftone grain', () => {
  const image = { width: 2, height: 1, data: new Uint8ClampedArray([20,20,20,255, 60,60,60,255]) };
  assert.deepEqual([...portraitPattern(image, 2)], [1,0,1,0]);
});
void test('blocks average source pixels before thresholding', () => {
  const image = { width: 4, height: 1, data: new Uint8ClampedArray([0,0,0,255, 200,200,200,255, 220,220,220,255, 240,240,240,255]) };
  assert.deepEqual([...portraitPattern(image, 2)], [1,0,1,0]);
});
void test('invalid camera images are rejected', () => {
  assert.throws(() => portraitPattern({ width: 0, height: 0, data: new Uint8ClampedArray() }));
});
