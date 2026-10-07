import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SimulationRun, validSimulationSettings } from '../lib/simulation-mode';
import { MixingIndicator } from '../lib/mixing-indicator';
import { MixingScenario, type ScenarioStage } from '../lib/mixing-scenario';
import { applyIntroSettings, DEFAULT_INTRO } from '../lib/intro-parameters';
import type { TrayTelemetry } from '../lib/native-host';

void test('simulation settings reject empty, fractional and out-of-range frequencies', () => {
  for (const wakesPerHour of [1, 6, 60]) assert.ok(validSimulationSettings({ enabled: true, wakesPerHour }));
  for (const wakesPerHour of [0, 61, 1.5, NaN, Infinity, '6', null]) assert.ok(!validSimulationSettings({ enabled: true, wakesPerHour }));
  assert.ok(!validSimulationSettings({ enabled: 1, wakesPerHour: 6 }));
  assert.ok(!validSimulationSettings(null));
});

function runDemonstration() {
  const run = new SimulationRun(), indicator = new MixingIndicator(), side = new MixingScenario();
  side.beginAfterWake();
  const stages = new Set<ScenarioStage>();
  let mixingFrames = 0, complete = false;
  for (let frame = 0; frame < 20000; frame++) {
    const now = frame / 30;
    const sample = run.sample(now, indicator.storyFrame.stage);
    if (sample.activity) mixingFrames++;
    const state: TrayTelemetry = { phase: sample.activity ? 'mixing' : 'ready', oil: 0, elapsed: now, activity: 0, ...sample };
    indicator.step(now, state);
    const remote = side.step(now, { gyro: state.gyro!, activity: state.activity, mixed: state.mixed == null ? null : Math.floor(state.mixed * 100) / 100,
      simulated: state.simulated, receivedAt: now });
    stages.add(remote.stage);
    assert.notEqual(remote.stage, 'failure');
    if (run.complete(indicator.storyFrame.stage)) { complete = true; break; }
  }
  assert.ok(complete, 'The entire story returns to standby so native can sleep');
  for (const stage of ['countdown', 'success', 'bon-appetit', 'connecting', 'restart'] as const) assert.ok(stages.has(stage), `Both iPads show ${stage}`);
  assert.ok(mixingFrames >= 179 && mixingFrames <= 181, 'Only six seconds of synthetic circular motion');
}

void test('six-second mixing demonstration completes the center and BLE-quantized side story', runDemonstration);
void test('demonstration succeeds with custom live thresholds and long analysis without changing those settings', () => {
  applyIntroSettings({ ...DEFAULT_INTRO, 'story.mixingConfirmation': 120, 'story.startWindow': 0,
    'story.pauseWindow': 0, 'story.analysis': 15, 'story.mixingThreshold': 1, 'story.successMixed': 1 });
  try { runDemonstration(); }
  finally { applyIntroSettings(DEFAULT_INTRO); }
});

void test('a new demonstration starts with clean input and cannot finish before a result', () => {
  const run = new SimulationRun();
  assert.equal(run.complete('standby'), false);
  assert.equal(run.sample(100, 'detected').activity, 0);
  assert.equal(run.sample(100, 'analysis').activity, 1);
  assert.equal(run.sample(106, 'analysis').mixed, 1);
  assert.equal(run.sample(106, 'analysis').activity, 0);
  run.sample(110, 'restart');
  assert.equal(run.complete('standby'), true);
  assert.equal(run.complete('standby'), false, 'Native completion is reported only once');
  assert.equal(run.sample(111, 'standby').mixed, null, 'The completed demonstration cannot restore success after the portion reset');
  assert.equal(run.sample(111, 'standby').activity, 0);
  assert.equal(new SimulationRun().complete('standby'), false);
});
