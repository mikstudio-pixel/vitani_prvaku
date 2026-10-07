import assert from 'node:assert/strict';
import { test } from 'node:test';
import { portraitPattern } from '../lib/portrait-material';
void test('portrait mask has upright WebGL rows and monochrome tones', () => {
  const image = { width: 2, height: 2, data: new Uint8ClampedArray([255,255,255,255, 0,0,0,255, 0,0,0,255, 255,255,255,255]) };
  assert.deepEqual([...portraitPattern(image, 2)], [1,0,0,1]);
});
void test('contrast adapts to low light without adding halftone grain', () => {
  const image = { width: 2, height: 1, data: new Uint8ClampedArray([20,20,20,255, 60,60,60,255]) };
  assert.deepEqual([...portraitPattern(image, 2)], [1,0,1,0]);
});
void test('blocks average source pixels before tone conversion', () => {
  const image = { width: 4, height: 1, data: new Uint8ClampedArray([0,0,0,255, 200,200,200,255, 220,220,220,255, 240,240,240,255]) };
  assert.deepEqual([...portraitPattern(image, 2)], [1,0,1,0]);
});
void test('invalid camera images are rejected', () => {
  assert.throws(() => portraitPattern({ width: 0, height: 0, data: new Uint8ClampedArray() }));
});

void test('transparent scenery cannot affect portrait contrast or the uniform background', () => {
  const data = new Uint8ClampedArray([0,0,0,255, 255,255,255,255, 0,0,0,0, 255,255,255,0]);
  const values = portraitPattern({ width: 4, height: 1, data }, 4);
  assert.equal(values[0], 1); assert.equal(values[1], 0);
  assert.ok(Math.abs(values[2] - .85) < 1e-6); assert.equal(values[2], values[3]);
  data[8] = data[9] = data[10] = 200; data[12] = data[13] = data[14] = 20;
  assert.deepEqual(portraitPattern({ width: 4, height: 1, data }, 4), values);
});
void test('facial shading retains intermediate monochrome levels', () => {
  const data = new Uint8ClampedArray([0,0,0,255, 64,64,64,255, 128,128,128,255, 192,192,192,255, 255,255,255,255]);
  const values = portraitPattern({ width: 5, height: 1, data }, 5);
  assert.ok([...values].some(value => value > 0 && value < 1));
});
