import assert from 'node:assert/strict';
import test from 'node:test';
import { SideWakeIntro, WakeIntro, WAKE } from '../lib/wake-intro';
import { MixingScenario, SCENARIO } from '../lib/mixing-scenario';

void test('wake lights the center first, then the side panels; sleep cancels and restarts it', () => {
  const wake = new WakeIntro();
  assert.equal(wake.frame(100).stage, 'waiting');
  wake.start(100);
  assert.equal(WAKE.orbit, SCENARIO.detected);
  assert.equal(wake.frame(100).stage, 'orbit');
  assert.equal(wake.frame(100 + WAKE.orbit - 0.01).stage, 'orbit');
  assert.equal(wake.frame(100 + WAKE.orbit + 0.01).stage, 'panels');
  assert.ok(wake.frame(100 + WAKE.orbit + 0.01).elapsed < .02, 'Panel animation starts from zero after detection');
  wake.sleep();
  assert.equal(wake.frame(200).stage, 'waiting');
  wake.start(200);
  assert.equal(wake.frame(200).progress, 0);
  assert.equal(wake.frame(200 + WAKE.orbit + WAKE.panels).stage, 'complete');
});

void test('a late side display joins the host panel clock and starts ready without replaying the opening question', () => {
  const wake = new SideWakeIntro(), story = new MixingScenario();
  const idle = { gyro: null, activity: 0, receivedAt: 0, mixed: null };
  wake.receive('introducing', 1.5, 10);
  story.seekIntro('panels', wake.frame(10).elapsed);
  assert.equal(story.step(10, idle).stage, 'panels');
  assert.equal(story.stageElapsed, 1.5);
  wake.receive('ready', 0, 11);
  assert.equal(wake.takeCompletion(), true);
  story.beginAfterWake({ skipIntro: true });
  assert.equal(story.step(11, idle).stage, 'authorized');
  assert.equal(story.stageElapsed, 0, 'Ready gets its full configured duration');
});

void test('late side packets seek to current phase time; interruptions never finish the intro', () => {
  const wake = new SideWakeIntro();
  wake.receive('introducing', 1.2, 10);
  assert.equal(wake.frame(10).progress, 0.5);
  assert.equal(wake.frame(20).stage, 'panels');
  assert.ok(wake.frame(20).progress < 0.6, 'Do not free-run a disconnected display');
  wake.receive('unavailable', 0, 20);
  assert.equal(wake.takeCompletion(), false);
  wake.receive('ready', 50, 21);
  assert.equal(wake.takeCompletion(), true);
  assert.equal(wake.takeCompletion(), false);
  wake.receive('mixing', 51, 22);
  assert.equal(wake.takeCompletion(), false, 'Regular packets must not restart the story');
  wake.sleep(); wake.receive('waking', 0, 23);
  assert.equal(wake.frame(23).stage, 'orbit');
  assert.equal(wake.takeCompletion(), false);
});

void test('the confirmed lift starts the story after the intro, retaining the full mixing window', () => {
  const story = new MixingScenario();
  story.beginAfterWake();
  let now = 0;
  const idle = { gyro: null, activity: 0, receivedAt: 0, mixed: 0.1 };
  assert.equal(story.step(now, idle).stage, 'detected', 'Holding still after wake needs no second lift');
  while (story.snapshot().stage !== 'analysis' && now < 20) { now += 0.05; story.step(now, idle); }
  assert.equal(story.snapshot().remaining, SCENARIO.startWindow);
  for (let i = 0; i < 138; i++) { now += 0.05; story.step(now, idle); }
  assert.notEqual(story.snapshot().stage, 'failure');
  for (let i = 0; i < 4; i++) { now += 0.05; story.step(now, idle); }
  assert.equal(story.snapshot().stage, 'failure');
});

void test('a side display without a host keeps local motion control, but cannot skip an active intro', () => {
  const wake = new SideWakeIntro();
  wake.useLocalFallback();
  assert.equal(wake.frame(0).stage, 'complete');
  assert.equal(wake.takeCompletion(), false, 'A missing host does not invent a lift');
  wake.receive('waking', 0.5, 1);
  wake.useLocalFallback();
  assert.equal(wake.frame(1).stage, 'orbit');
  assert.equal(wake.takeCompletion(), false);
});
