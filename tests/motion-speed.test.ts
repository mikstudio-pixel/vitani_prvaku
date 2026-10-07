import assert from 'node:assert/strict';
import test from 'node:test';
import { MotionSpeed } from '../lib/motion-speed';

const sample = (x: number, receivedAt: number) => ({ gyro: { x, y: 0, z: 0 }, activity: 0.7, receivedAt });

void test('speed uses measured angular travel and wraps at 180 degrees', () => {
  const meter = new MotionSpeed();
  assert.equal(meter.sample(sample(179, 0), 'local')?.rpm, null);
  const result = meter.sample(sample(-175, 0.1), 'local');
  assert.ok(Math.abs(result!.rpm! - 10) < 1e-6);
  assert.equal(meter.sample(sample(-175, 0.1), 'local')?.rpm, result?.rpm);
});

void test('source switches, missing angles and long gaps never invent rotation', () => {
  const meter = new MotionSpeed();
  meter.sample(sample(0, 0), 'local');
  assert.equal(meter.sample(sample(120, 0.1), 'bluetooth')?.rpm, null);
  assert.equal(meter.sample(sample(160, 3), 'bluetooth')?.rpm, null);
  assert.equal(meter.sample(null, 'none'), null);
  assert.equal(meter.sample(sample(-100, 3.1), 'local')?.rpm, null);
  assert.equal(meter.sample({ gyro: null, activity: 0.8, receivedAt: 3.2 }, 'local')?.rpm, null);
  assert.equal(meter.sample(sample(0, 3.3), 'local')?.rpm, null);
});

void test('holding the tray still converges to zero despite activity from acceleration', () => {
  const meter = new MotionSpeed();
  meter.sample(sample(0, 0), 'local');
  meter.sample(sample(6, 0.1), 'local');
  let result;
  for (let i = 2; i < 30; i++) result = meter.sample(sample(6, i / 10), 'local');
  assert.equal(Math.round(result!.rpm!), 0);
});
