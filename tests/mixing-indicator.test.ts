import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MixingIndicator, INDICATOR_READY, mixingIndicatorColor } from '../lib/mixing-indicator';
import type { TrayTelemetry } from '../lib/native-host';
import { SCENARIO, MIXING_FINALE } from '../lib/mixing-scenario';

const finale = MIXING_FINALE.sound + MIXING_FINALE.pause;
const preparation = () => SCENARIO.detected + SCENARIO.panels + SCENARIO.authorized + SCENARIO.decision + SCENARIO.countdown + SCENARIO.analysis;

function fixture() {
  const light = new MixingIndicator();
  let now = 0;
  let elapsed = 0;
  const advance = (seconds: number, activity: number, mixed: number | null, introducing = false) => {
    let frame = INDICATOR_READY;
    for (let i = 0; i < Math.round(seconds * 20); i++) {
      now += 0.05; elapsed += 0.05;
      const state: TrayTelemetry = { phase: activity > 0 ? 'mixing' : 'ready', activity, mixed, tiltX: 0, tiltY: 0, oil: 0, elapsed };
      frame = light.step(now, state, introducing);
    }
    return frame;
  };
  return { light, advance, resetPortion: () => { elapsed = 0; } };
}

void test('wake is white, mixing uses the panel blue and pauses retain the color', () => {
  const f = fixture();
  assert.deepEqual(f.advance(1, 0.8, 0.7, true), INDICATOR_READY);
  assert.deepEqual(f.advance(1, 0, 0.2), { ...INDICATOR_READY, prompt: 'detected' });
  f.advance(preparation() - 1, 0, 0.2);
  const half = f.advance(1, 0.8, 0.45);
  assert.deepEqual(half, { phase: 'mixing', progress: 0.5 });
  assert.equal(mixingIndicatorColor(half), '#1279FF');
  assert.deepEqual(f.advance(1, 0, 0.2), half);
  assert.equal(mixingIndicatorColor({ phase: 'mixing', progress: 1 }), '#1279FF');
});

void test('green follows the story, then returns to ready after the message, twenty-second countdown after putting down the tray', () => {
  const f = fixture();
  assert.notEqual(f.advance(1, 0.8, 1).phase, 'success', 'No success before the introduction/countdown');
  f.advance(preparation(), 0.8, 0.5);
  assert.notEqual(f.advance(0.25, 0.8, 0.99).phase, 'success', 'A brief spike cannot complete mixing');
  f.advance(0.2, 0.8, 0.5);
  assert.equal(f.advance(0.7 + finale, 0.8, 0.99).phase, 'success');
  assert.equal(f.advance(65, 0.8, 0.1).phase, 'success', 'Movement keeps the result visible');
  assert.equal(f.advance(7, 0, 0.1).phase, 'success', 'Seven quiet seconds are not enough');
  assert.deepEqual(f.advance(14, 0, 0.1), INDICATOR_READY, 'The twenty-second story reset clears the result');
  assert.deepEqual(f.advance(20, 0, 0.1), INDICATOR_READY, 'Standby waits for the next gesture');
  assert.equal(f.advance(preparation() + 1 + finale, 0.8, 0.99).phase, 'success', 'A new attempt works without sleeping');
  assert.deepEqual(f.advance(0.1, 0, 0.1, true), INDICATOR_READY, 'A wake clears a successful result');
  f.advance(preparation(), 0.8, 0.99);
  assert.equal(f.advance(1 + finale, 0.8, 0.99).phase, 'success');
  f.resetPortion();
  assert.deepEqual(f.advance(0.1, 0, 0.1), { ...INDICATOR_READY, prompt: 'detected' });
});

void test('missing fluid data and failure never turn green; another wake clears the previous result', () => {
  const f = fixture();
  assert.notEqual(f.advance(20, 0.8, null).phase, 'success');
  assert.notEqual(f.advance(8, 0, null).phase, 'success');
  assert.notEqual(f.advance(2, 0, 1).phase, 'success', 'Late data cannot change a failed attempt');
  assert.deepEqual(f.advance(1, 0, null, true), INDICATOR_READY);
  assert.notEqual(f.advance(18, 0, 1).phase, 'success', 'Passive mixing is not a successful user attempt');
  assert.notEqual(f.advance(1, 0.8, Number.NaN).phase, 'success');
});

void test('90% completion holds DOMÍCHÁNO and 100% before releasing the QR', () => {
  const f = fixture();
  f.advance(preparation(), 0.8, 0.5);
  assert.notEqual(f.advance(1, 0.8, 0.89).phase, 'success');
  let frame = f.advance(.7, 0.8, .9);
  assert.equal(f.light.storyFrame.stage, 'finishing');
  assert.equal(frame.prompt, undefined, 'DOMÍCHÁNO waits for the sound and silent gap');
  assert.equal(frame.phase, 'mixing');
  assert.equal(f.light.qrReady, false);
  assert.equal(f.light.physicsPaused, false, 'Finale drives the liquid until the ding');
  while (f.light.storyFrame.elapsed < MIXING_FINALE.sound) f.advance(.05, 0, .9);
  assert.equal(f.light.storyFrame.stage, 'finishing');
  assert.equal(f.light.physicsPaused, false, 'The silent gap keeps spinning until the ding');
  for (let i = 0; i < 100 && frame.phase !== 'success'; i++) frame = f.advance(0.05, 0.8, 0.9);
  assert.deepEqual(frame, { phase: 'success', progress: 1, prompt: 'done' });
  assert.equal(f.light.qrReady, false);
  assert.equal(f.light.physicsPaused, true);
  assert.deepEqual(f.advance(SCENARIO.result - 0.15, 0, 0.1), frame, 'The completed result survives new lower measurements');
  const next = f.advance(0.3, 0, 0.1);
  assert.equal(next.phase, 'success');
  assert.equal(next.progress, 1);
  assert.equal(next.prompt, undefined);
  assert.equal(f.light.qrReady, true);
  assert.equal(f.light.physicsPaused, false);
  f.light.reset();
  assert.equal(f.light.qrReady, false);
});

void test('central captions follow the full ready/countdown/start sequence and clear on wake', () => {
  const f = fixture();
  const captions: string[] = [];
  let last = '';
  for (let i = 0; i < Math.ceil((preparation() + 1) * 20); i++) {
    const frame = f.advance(0.05, 0.8, 0.2);
    if (frame.prompt && frame.prompt !== last) captions.push(frame.prompt);
    last = frame.prompt ?? '';
  }
  assert.deepEqual(captions, ['detected', 'ready', '3', '2', '1', 'start']);
  assert.equal(last, '', 'Mixing has no countdown over the fluid');
  assert.deepEqual(f.advance(0.1, 0, 0.1, true), INDICATOR_READY);
});

void test('physics stays frozen through preparation and all three numbers; Míchej releases it', () => {
  const indicator = new MixingIndicator();
  assert.equal(indicator.physicsPaused, true);
  const state: TrayTelemetry = { phase: 'ready', activity: 0, mixed: 0.8, tiltX: 0, tiltY: 0, oil: 0, elapsed: 0 };
  const seen = new Set<string>();
  for (let now = 0; now < preparation() + 1; now += 0.05) {
    const frame = indicator.step(now, state);
    if (frame.prompt) seen.add(frame.prompt);
    if (['detected', 'ready', '3', '2', '1'].includes(frame.prompt ?? '')) {
      assert.equal(indicator.physicsPaused, true);
      assert.equal(frame.progress, 0, 'Input during preparation does not color the mixing dot');
    }
    if (frame.prompt === 'start') assert.equal(indicator.physicsPaused, false);
  }
  assert.deepEqual([...seen], ['detected', 'ready', '3', '2', '1', 'start']);
  indicator.reset();
  assert.equal(indicator.physicsPaused, true);
});

void test('a fresh portion after the completed story waits for another lift instead of replaying the intro', () => {
  const f = fixture();
  f.advance(preparation(), 0.8, 0.5);
  assert.equal(f.advance(1 + finale, 0.8, 0.99).phase, 'success');
  f.advance(70, 0, 0.99);
  assert.equal(f.light.storyFrame.stage, 'standby');
  f.light.reset({ waitForLift: true });
  f.resetPortion();
  assert.deepEqual(f.advance(5, 0, null), INDICATOR_READY);
  assert.equal(f.light.storyFrame.stage, 'standby');
  assert.equal(f.light.physicsPaused, true);
  assert.equal(f.light.qrReady, false);
  assert.equal(f.advance(preparation() + 1 + finale, 0.8, 0.99).phase, 'success', 'A second attempt starts from the new portion');
});
