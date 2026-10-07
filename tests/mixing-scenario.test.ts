import assert from 'node:assert/strict';
import test from 'node:test';
import { MixingScenario, SCENARIO, MIXING_FINALE, visualMixingProgress, scenarioPreview, selectMotion, type MotionSample, type ScenarioStage } from '../lib/mixing-scenario';

const sample = (activity: number, receivedAt = 0, mixed: number | null = 0.1): MotionSample => ({ gyro: { x: 1, y: 2, z: 3 }, activity, receivedAt, mixed });
function fixture() {
  const scenario = new MixingScenario();
  let now = 0;
  scenario.step(now, sample(0));
  return {
    scenario,
    advance(seconds: number, activity: number | null, mixed: number | null = 0.1) {
      for (let i = 0; i < Math.round(seconds * 20); i++) {
        now += 0.05;
        scenario.step(now, activity === null ? null : sample(activity, now, mixed));
      }
      return scenario.snapshot();
    },
    until(stage: ScenarioStage, activity: number, mixed: number | null = 0.1) {
      for (let i = 0; i < 1000; i++) {
        now += 0.05;
        const state = scenario.step(now, sample(activity, now, mixed));
        if (state.stage === stage) return state;
      }
      assert.fail(`Stage ${stage} not reached`);
    },
  };
}

void test('standby ignores sensor noise and a brief bump, then confirms a lift', () => {
  const f = fixture();
  assert.equal(f.advance(2, 0.1).stage, 'standby');
  assert.equal(f.advance(0.1, 1).stage, 'standby');
  assert.equal(f.advance(1, 0).stage, 'standby');
  assert.equal(f.advance(0.3, 0.7).stage, 'detected');
});

void test('actual mixing keeps the combined message and counts twenty seconds after putting down the tray', () => {
  const f = fixture();
  for (const stage of ['detected', 'panels', 'authorized', 'decision', 'countdown', 'analysis', 'mixing'] as const) f.until(stage, 0.7);
  f.until('keep-mixing', 0.7, 0.6);
  f.until('success', 0.7, 0.97);
  assert.equal(f.advance(SCENARIO.result - 0.1, 0, 0.3).stage, 'success');
  assert.equal(f.until('bon-appetit', 0).mixed, 0.97, 'Result retains the measured value, not a fabricated 100%');
  f.until('connecting', .7);
  assert.equal(f.advance(40, .7).stage, 'connecting', 'Movement retains the message without a deadline');
  assert.equal(f.until('restart', 0).remaining, 20);
  assert.equal(f.advance(SCENARIO.restart - 2, 0).stage, 'restart');
  assert.equal(f.advance(2.05, 0).stage, 'standby');
});

void test('not starting within seven seconds follows the full failure branch', () => {
  const f = fixture();
  f.until('detected', 0.7); f.until('analysis', 0);
  f.until('stir-prompt', 0); f.until('not-mixing', 0);
  assert.equal(f.until('failure', 0).mixed, 0.1);
  assert.equal(f.advance(SCENARIO.result - 0.1, 0).stage, 'failure');
  assert.equal(f.until('hungry', 0).remaining, SCENARIO.retry);
  assert.equal(f.advance(SCENARIO.farewell - 0.1, 0).stage, 'hungry');
  assert.equal(f.advance(SCENARIO.retry - SCENARIO.farewell, 0).stage, 'hungry');
  assert.equal(f.advance(1, 0).stage, 'standby');
});

void test('elapsed time and vigorous motion cannot substitute for actual mixing', () => {
  const f = fixture();
  f.until('analysis', 0.7);
  const state = f.advance(30, 0.9, 0.3);
  assert.equal(state.stage, 'mixing');
  assert.equal(state.progress, 0.3);
  assert.equal(state.deadline, null);
  assert.equal(f.advance(10, 0.9, null).mixed, null);
  assert.equal(f.scenario.snapshot().stage, 'mixing');
});

void test('progress falls with separation, then recovers when stirring resumes', () => {
  const f = fixture();
  f.until('keep-mixing', 0.7, 0.8);
  const paused = f.advance(2, 0, 0.45);
  assert.equal(paused.progress, 0.45);
  assert.equal(paused.deadline, 'resume');
  assert.ok(Math.abs(paused.remaining - 5) < 0.01);
  const resumed = f.advance(1, 0.7, 0.65);
  assert.equal(resumed.progress, 0.65);
  assert.equal(resumed.stage, 'keep-mixing');
  assert.equal(resumed.deadline, null);
  f.until('success', 0.7, 0.97);
});

void test('a long pause fails even after mixing has started', () => {
  const f = fixture();
  f.until('keep-mixing', 0.7, 0.75);
  assert.equal(f.advance(6.8, 0, 0.2).stage, 'not-mixing');
  assert.equal(f.advance(0.3, 0, 0.15).stage, 'failure');
  f.until('hungry', 0);
});

void test('starting near the deadline cancels the start timeout and each pause has its own window', () => {
  const f = fixture();
  f.until('detected', 0.7); f.until('analysis', 0);
  f.advance(6.5, 0);
  assert.equal(f.advance(1, 0.7, 0.2).stage, 'mixing');
  f.advance(6, 0, 0.1); f.advance(1, 0.7, 0.3);
  const secondPause = f.advance(1, 0, 0.25);
  assert.ok(Math.abs(secondPause.remaining - 6) < 0.01);
  assert.equal(secondPause.deadline, 'resume');
});

void test('success needs sustained real mixing, not a spike or stale/missing data', () => {
  const f = fixture();
  f.until('mixing', 0.7);
  assert.equal(f.advance(0.3, 0.7, 0.96).stage, 'keep-mixing');
  f.advance(0.1, 0.7, 0.89);
  f.advance(0.3, 0.7, 0.96); f.advance(0.1, 0.7, null);
  assert.equal(f.advance(0.3, 0.7, 0.96).stage, 'keep-mixing');
  assert.equal(f.advance(0.3, 0.7, 0.96).stage, 'finishing');
});

void test('missing motion pauses deadlines; unknown fluid data hides progress', () => {
  const f = fixture();
  f.until('detected', 0.7); f.until('stir-prompt', 0);
  const before = f.scenario.snapshot();
  const after = f.advance(30, null);
  assert.equal(after.stage, before.stage); assert.equal(after.remaining, before.remaining);
  assert.equal(after.progress, null);
  assert.equal(f.scenario.step(10_000, sample(0)).stage, 'stir-prompt');
});

void test('calibration previews use explicit fluid values independently of the timer', () => {
  assert.equal(scenarioPreview('analysis').remaining, 7);
  assert.equal(scenarioPreview('mixing').remaining, 0);
  assert.equal(scenarioPreview('mixing').progress, 0.3);
  assert.equal(scenarioPreview('not-mixing').remaining, 3.2);
  assert.equal(scenarioPreview('bon-appetit').mixed, 1);
  assert.equal(scenarioPreview('hungry').progress, 0.1);
});

void test('fresh Bluetooth wins; stale, unavailable or sleeping hosts fall back without inventing fluid data', () => {
  const local = sample(0.7, 12.9, null);
  const remote = { ...sample(0, 10, 0.7), phase: 'ready' as const };
  assert.equal(selectMotion(remote, local, 12.99).sample?.mixed, 0.7);
  assert.equal(selectMotion(remote, local, 13).sample?.mixed, null);
  for (const phase of ['unavailable', 'sleeping'] as const) assert.equal(selectMotion({ ...remote, phase, receivedAt: 13 }, local, 13).source, 'local');
  assert.equal(selectMotion({ ...remote, receivedAt: 13.1 }, local, 13.1).source, 'bluetooth');
  assert.equal(selectMotion(null, local, 14).source, 'none');
});

void test('completion accepts exactly 90 percent after confirmation, never 89.9 percent', () => {
  const f = fixture();
  f.until('mixing', 0.7);
  assert.equal(f.advance(2, 0.7, 0.899).stage, 'keep-mixing');
  assert.equal(f.advance(0.3, 0.7, 0.9).stage, 'keep-mixing');
  assert.equal(f.advance(0.3, 0.7, 0.9).stage, 'finishing');
});

void test('confirmed finish locks the measurement, plays once, then holds 200ms silence before the result', () => {
  const f = fixture();
  f.until('mixing', .7);
  f.until('finishing', .7, .9);
  assert.equal(f.advance(MIXING_FINALE.sound, 0, .3).stage, 'finishing');
  assert.equal(f.scenario.snapshot().mixed, .9, 'Confirmed completion is retained even when the tray stops');
  assert.equal(f.advance(.15, 0, null).stage, 'finishing', 'No result during the silent gap');
  assert.equal(f.advance(.1, 0, .3).stage, 'success');
  f.scenario.reset();
  assert.equal(f.scenario.snapshot().stage, 'standby', 'Sleep/reset cancels a pending finale');
});

void test('retry countdown follows the story clock and pauses when motion data is missing', () => {
  const f = fixture();
  f.until('detected', 0.7);
  f.until('hungry', 0);
  assert.equal(Math.ceil(f.scenario.snapshot().remaining), 15);
  assert.equal(Math.ceil(f.advance(1.05, 0).remaining), 14);
  const paused = f.scenario.snapshot().remaining;
  assert.equal(f.advance(3, null).remaining, paused);
  assert.equal(Math.ceil(f.advance(13, 0).remaining), 1);
  assert.equal(f.advance(1.1, 0).stage, 'standby');
  assert.equal(scenarioPreview('hungry').remaining, SCENARIO.retry);
});

void test('visual completion maps the physical success threshold to 100% without changing it', () => {
  assert.equal(SCENARIO.successMixed, .9);
  assert.equal(visualMixingProgress(null), null);
  assert.equal(visualMixingProgress(0), 0);
  assert.equal(visualMixingProgress(.45), .5);
  assert.equal(visualMixingProgress(.81), .9);
  assert.equal(visualMixingProgress(.9), 1);
  assert.equal(visualMixingProgress(1), 1);
  assert.equal(SCENARIO.restart, 20);
});

void test('movement cancels the end countdown, then putting down starts a full twenty seconds again', () => {
  const f = fixture();
  f.until('success', .7, .97);
  f.until('connecting', .7);
  f.until('restart', 0);
  assert.ok(Math.abs(f.advance(8, 0).remaining - 12) < .01);
  assert.equal(f.advance(.1, .2).stage, 'connecting', 'Even motion below the mixing threshold cancels shutdown');
  const restarted = f.until('restart', 0);
  assert.equal(restarted.remaining, 20);
  assert.equal(f.advance(19.9, 0).stage, 'restart');
  assert.equal(f.advance(.15, 0).stage, 'standby');
});

void test('end countdown uses native settled-tray detection, including slow tilting', () => {
  const machine = new MixingScenario();
  machine.beginAfterWake();
  let now = 0;
  const step = (activity: number, quiet: number) => machine.step(now += .05, { ...sample(activity, now, .97), quiet });
  for (let i = 0; i < 2000 && machine.snapshot().stage !== 'connecting'; i++) step(.7, 0);
  assert.equal(machine.snapshot().stage, 'connecting');
  for (let i = 0; i < 200; i++) step(0, 0);
  assert.equal(machine.snapshot().stage, 'connecting', 'Quiet strength alone cannot start the countdown');
  assert.equal(step(0, .8).stage, 'restart');
  assert.equal(step(0, .1).stage, 'connecting', 'A native motion event cancels even when its instantaneous strength is zero');
});
