import assert from 'node:assert/strict';
import test from 'node:test';
import { SoundSequence, mixingSound, type SoundFrame } from '../lib/sound-design';

const frame = (stage: SoundFrame['stage'], overrides: Partial<SoundFrame> = {}): SoundFrame =>
  ({ stage, elapsed: 0, activity: .5, progress: .3, available: true, ...overrides });

void test('each display owns its cues; telemetry repeats never replay them', () => {
  const center = new SoundSequence('center'), left = new SoundSequence('left'), right = new SoundSequence('right');
  assert.deepEqual(center.step(frame('detected')), ['wake']);
  assert.deepEqual(center.step(frame('detected')), []);
  assert.deepEqual(left.step(frame('detected')), []);
  assert.deepEqual(right.step(frame('detected')), []);
  assert.deepEqual(left.step(frame('panels')), ['panels']);
  assert.deepEqual(right.step(frame('panels')), ['panels']);
  assert.deepEqual(center.step(frame('panels')), []);
  assert.deepEqual(center.step(frame('success')), ['ding']);
  assert.deepEqual(right.step(frame('failure')), ['failure']);
  assert.deepEqual(left.step(frame('failure')), []);
});

void test('countdown follows adjustable visual clock and does not tick in gaps', () => {
  const sequence = new SoundSequence('center');
  assert.deepEqual(sequence.step(frame('countdown')), ['countdown']);
  assert.deepEqual(sequence.step(frame('countdown', { elapsed: .5 })), []);
  assert.deepEqual(sequence.step(frame('countdown', { elapsed: 1 })), ['countdown']);
  assert.deepEqual(sequence.step(frame('countdown', { elapsed: 2 })), ['countdown']);
  assert.deepEqual(sequence.step(frame('countdown', { elapsed: 3 })), ['countdown-start']);
});

void test('riser only starts at confirmed finish; lingering near completion stays silent', () => {
  const sequence = new SoundSequence('center');
  assert.deepEqual(sequence.step(frame('mixing', { progress: null })), []);
  assert.deepEqual(sequence.step(frame('mixing', { progress: .9, activity: 0 })), []);
  assert.deepEqual(sequence.step(frame('mixing', { progress: .9, available: false })), []);
  assert.deepEqual(sequence.step(frame('keep-mixing', { progress: .9 })), []);
  assert.deepEqual(sequence.step(frame('keep-mixing', { progress: .95 })), []);
  assert.deepEqual(sequence.step(frame('finishing', { progress: 1, activity: 0 })), ['riser']);
  assert.deepEqual(sequence.step(frame('finishing', { progress: 1, elapsed: 2 })), []);
  assert.deepEqual(sequence.step(frame('success')), ['ding']);
  assert.deepEqual(sequence.step(frame('restart')), []);
  assert.deepEqual(sequence.step(frame('restart')), []);
  assert.deepEqual(sequence.step(frame('standby')), ['sleep']);
  assert.deepEqual(sequence.step(frame('detected')), ['wake']);
  assert.deepEqual(sequence.step(frame('finishing', { progress: 1 })), ['riser']);
});

void test('mixing energy follows speed, pitch also follows progress, invalid data stays silent', () => {
  const slow = mixingSound(frame('mixing', { activity: .1, progress: .1 }));
  const fast = mixingSound(frame('mixing', { activity: .9, progress: .1 }));
  const late = mixingSound(frame('mixing', { activity: .9, progress: .9 }));
  assert(fast.volume > slow.volume);
  assert(fast.rate > slow.rate);
  assert(late.rate > fast.rate);
  for (const input of [frame('success'), frame('mixing', { activity: 0 }), frame('mixing', { activity: NaN }), frame('mixing', { available: false })]) assert.equal(mixingSound(input).volume, 0);
  assert(Number.isFinite(mixingSound(frame('mixing', { progress: NaN })).rate));
});
