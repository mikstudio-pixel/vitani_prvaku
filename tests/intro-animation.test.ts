import assert from 'node:assert/strict';
import test from 'node:test';
import { curveProgress, trackProgress, INTRO, panelsDuration, ringDuration } from '../lib/intro-animation';

void test('independent animation tracks respect delay, duration and CSS timing curves', () => {
  const track = { delay: 0.4, duration: 2, curve: [0, 0, 1, 1] as const };
  assert.equal(trackProgress(0, track), 0);
  assert.ok(Math.abs(trackProgress(1.4, track) - 0.5) < 1e-6);
  assert.equal(trackProgress(2.4, track), 1);
  assert.ok(curveProgress(0.25, [0, 0, 0.58, 1]) > 0.25, 'Ease-out starts faster than linear');
  assert.ok(curveProgress(0.25, [0.42, 0, 1, 1]) < 0.25, 'Ease-in starts slower than linear');
  assert.equal(trackProgress(-Infinity, track), 0);
  assert.equal(trackProgress(Infinity, track), 1);
  assert.equal(trackProgress(0.4, { ...track, duration: 0 }), 1);
});

void test('intro ends only after every panel track; both phases fit the BLE phase clock', () => {
  const { pauseAfter, ...tracks } = INTRO.panels;
  for (const track of Object.values(tracks)) assert.ok(panelsDuration() >= track.delay + track.duration + pauseAfter - 1e-10);
  assert.ok(ringDuration() <= 5.1, 'BLE V4 supports up to 5.1 seconds per intro phase');
  assert.ok(panelsDuration() <= 5.1, 'BLE V4 supports up to 5.1 seconds per intro phase');
});
