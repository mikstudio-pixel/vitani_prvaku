import assert from 'node:assert/strict';
import test from 'node:test';
import { LED_COUNT, LED_PITCH, lightFromTilt, ringLights, ringSegmentLevels, TiltLightMotion } from '../lib/tilt-light';
import { INTRO, blinkDuration, ringDuration } from '../lib/intro-animation';

void test('the light uses screen-calibrated tilt for all four directions and darkness at rest', () => {
  for (const [x, y, angle] of [[0, -1, 0], [1, 0, Math.PI / 2], [0, 1, Math.PI], [-1, 0, Math.PI * 1.5]]) {
    assert.ok(Math.abs(lightFromTilt({ x, y }).direction - angle) < 1e-10);
  }
  assert.equal(lightFromTilt({ x: 0, y: 0 }).strength, 0);
});

void test('each countdown numeral extinguishes the full ring clockwise, then restarts fully lit', () => {
  const frame = { stage: 'complete' as const, progress: 1, elapsed: 0 };
  const at = (elapsed: number) => ringLights(frame, { direction: 0.13, strength: 0.6 }, { stage: 'countdown', elapsed });
  for (const second of [0, 1, 2]) {
    assert.ok(ringSegmentLevels(at(second)).every(level => Math.abs(level.light - 0.95) < 1e-10));
    let previous = at(second).span;
    for (let t = 0.01; t < 1; t += 0.01) {
      const sweep = at(second + t);
      assert.equal(sweep.phase, 'countdown');
      assert.ok(sweep.span < previous);
      previous = sweep.span;
    }
    assert.ok(at(second + 0.9999).span < 0.00001);
    const half = ringSegmentLevels(at(second + 0.5));
    assert.equal(half[6].light, 0, 'Clockwise first half is extinguished');
    assert.ok(half[18].light > 0.9, 'Second half remains lit');
  }
});

void test('Míchej blinks exactly twice and collapses continuously across the physics start', () => {
  const signal = { direction: 0.13, strength: 0.6 };
  const frame = { stage: 'complete' as const, progress: 1, elapsed: 0 };
  const at = (elapsed: number) => ringLights(frame, signal, elapsed < 0.6
    ? { stage: 'countdown', elapsed: 3 + elapsed } : { stage: 'analysis', elapsed: elapsed - 0.6 });
  let darkRuns = 0, wasDark = false;
  for (let t = 0; t < ringDuration(); t += 0.005) {
    const sweep = at(t), dark = sweep.phase === 'blink' && sweep.light < 0.001;
    if (dark && !wasDark) darkRuns++;
    wasDark = dark;
    if (sweep.phase === 'blink') assert.ok(ringSegmentLevels(sweep).every(level => Math.abs(level.light - sweep.light) < 1e-10));
  }
  assert.equal(darkRuns, 2);
  const collapseStart = INTRO.ring.blink.count * blinkDuration();
  let previous = at(collapseStart).span;
  for (let t = collapseStart + 1 / 120; t < ringDuration(); t += 1 / 120) {
    assert.ok(at(t).span < previous);
    assert.equal(at(t).angle, signal.direction);
    previous = at(t).span;
  }
  const steady = ringLights(frame, signal);
  assert.deepEqual(at(ringDuration() + 0.001), steady);
  assert.ok(Math.abs(at(0.6 - 0.00001).span - at(0.6).span) < 0.001, 'No restart between countdown and analysis');
});

void test('fixed LEDs crossfade between neighbours without a brightness dip, including the wrap', () => {
  const frame = { stage: 'complete' as const, progress: 1, elapsed: 0 };
  for (let position = -1; position <= LED_COUNT; position += 0.125) {
    const levels = ringSegmentLevels(ringLights(frame, { direction: position * LED_PITCH, strength: 1 }));
    const active = levels.filter(level => level.light > 1e-10);
    assert.ok(active.length <= 2, 'Only the two neighbouring whole LEDs may light');
    assert.ok(Math.abs(levels.reduce((sum, level) => sum + level.light, 0) - 1) < 1e-10);
  }
  const halfway = ringSegmentLevels(ringLights(frame, { direction: -LED_PITCH / 2, strength: 1 }));
  assert.ok(Math.abs(halfway[0].light - 0.5) < 1e-10);
  assert.ok(Math.abs(halfway[23].light - 0.5) < 1e-10);
  assert.ok(ringSegmentLevels(ringLights(frame, { direction: 1, strength: 0 })).every(level => level.light === 0 && level.peak === 0));
});

void test('preparation stays fully lit; collapse follows gyro changes and finishes dark when flat', () => {
  const frame = { stage: 'complete' as const, progress: 1, elapsed: 0 };
  for (const stage of ['detected', 'panels', 'authorized', 'decision'] as const) {
    assert.ok(ringSegmentLevels(ringLights(frame, { direction: 0, strength: 0 }, { stage, elapsed: 0 })).every(level => level.light > 0.9));
  }
  const story = { stage: 'analysis' as const, elapsed: ringDuration() - 0.6 - 0.1 };
  assert.equal(ringLights(frame, { direction: -0.2, strength: 0.7 }, story).angle, -0.2);
  assert.equal(ringLights(frame, { direction: 0.3, strength: 0.7 }, story).angle, 0.3);
  const end = ringLights(frame, { direction: 0.3, strength: 0 }, { ...story, elapsed: ringDuration() });
  assert.equal(end.light, 0);
  assert.equal(end.peak, 0);
});

void test('sensor interpolation crosses zero by the short route and held or missing data settles', () => {
  const light = new TiltLightMotion();
  light.receive({ direction: Math.PI * 2 - 0.01, strength: 0.8 });
  for (let i = 0; i < 100; i++) light.advance(1 / 60);
  light.receive({ direction: 0.01, strength: 0.8 });
  const crossing = light.advance(1 / 60);
  assert.ok(Math.cos(crossing.direction) > 0.99, 'Must not spin backwards through half a turn');
  for (let i = 0; i < 100; i++) light.advance(1 / 60);
  assert.equal(light.settled, true);
  assert.deepEqual(light.advance(1 / 60), { direction: 0.01, strength: 0.8 });
  light.receive(null);
  for (let i = 0; i < 100; i++) light.advance(1 / 60);
  assert.equal(light.advance(1 / 60).strength, 0);
});
