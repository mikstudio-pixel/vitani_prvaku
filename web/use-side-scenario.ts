import { useEffect, useRef, useState } from 'react';
import { isNativeHost, isNativePaused, nativeCommand, reportSimulationReady, type GyroAngles, type TraySync, type StoryClock } from '@/lib/native-host';
import { MixingScenario, selectMotion, scenarioPreview, type MotionInput, type MotionSample, type ScenarioStage } from '@/lib/mixing-scenario';
import { browserGyro } from '@/lib/gyroscope-pose';
import { countdownFrame } from '@/lib/intro-parameters';
import { MotionSpeed, angleDifference } from '@/lib/motion-speed';
import { SideWakeIntro, storyWakeFrame } from '@/lib/wake-intro';

type Demo = 'live' | 'mix' | 'still';
const time = () => performance.now() / 1000;

export function useSideScenario(sync: TraySync) {
  const machine = useRef(new MixingScenario());
  const speed = useRef(new MotionSpeed());
  const wake = useRef(new SideWakeIntro(isNativeHost()));
  const local = useRef<MotionSample | null>(null);
  const remote = useRef<(MotionSample & { phase: NonNullable<TraySync['telemetry']>['phase']; elapsed: number; story?: StoryClock }) | null>(null);
  const mode = useRef<{ demo: Demo; started: number; frozen: ScenarioStage | null }>({ demo: 'live', started: 0, frozen: null });
  const [view, setView] = useState(() => ({ intro: new SideWakeIntro(isNativeHost()).frame(time()), scenario: new MixingScenario().snapshot(), scenarioElapsed: 0, input: { source: 'none', sample: null } as MotionInput, demo: 'live' as Demo, frozen: null as ScenarioStage | null }));
  const [sensorError, setSensorError] = useState('');

  useEffect(() => {
    // The host wake clock reaches dark side displays; old results do not.
    const phase = sync.telemetry?.phase;
    if (document.hidden || (isNativePaused() && phase !== 'waking' && phase !== 'introducing' && phase !== 'sleeping')) return;
    const freshPortion = sync.telemetry?.phase === 'ready' && remote.current
      && ['ready', 'mixing', 'settling'].includes(remote.current.phase) && sync.telemetry.elapsed < remote.current.elapsed;
    if (freshPortion || (remote.current?.simulated && sync.telemetry && !sync.telemetry.simulated)) {
      machine.current.reset(); speed.current = new MotionSpeed(); local.current = null;
    }
    remote.current = sync.telemetry ? { gyro: sync.telemetry.gyro ?? null, light: sync.telemetry.light, activity: sync.telemetry.activity, mixed: sync.telemetry.mixed, simulated: sync.telemetry.simulated, phase: sync.telemetry.phase, elapsed: sync.telemetry.elapsed, story: sync.telemetry.story, receivedAt: time() } : null;
    if (sync.telemetry) wake.current.receive(sync.telemetry.phase, sync.telemetry.elapsed, time());
    else if (!isNativePaused()) wake.current.useLocalFallback();
  }, [sync]);

  useEffect(() => {
    const orientation = (event: DeviceOrientationEvent) => {
      if (isNativeHost() || event.beta === null || event.gamma === null || event.alpha === null) return;
      const gyro: GyroAngles = browserGyro(event.alpha, event.beta, event.gamma);
      if (!Object.values(gyro).every(Number.isFinite)) return;
      const now = time(), previous = local.current;
      const dt = previous ? now - previous.receivedAt : 0;
      const speed = previous?.gyro && dt > 0 && dt < 0.5 ? Math.hypot(...(['x', 'y', 'z'] as const).map(axis => angleDifference(gyro[axis], previous.gyro![axis]))) / dt : 0;
      local.current = { gyro, activity: Math.min(1, speed / 45), receivedAt: now };
    };
    const resetAfterPause = () => {
      local.current = null;
      if (document.hidden || isNativePaused()) {
        machine.current.reset(); wake.current.sleep(); remote.current = null;
        speed.current = new MotionSpeed();
      }
    };
    window.addEventListener('deviceorientation', orientation);
    window.addEventListener('vitani-prvaku:power', resetAfterPause);
    document.addEventListener('visibilitychange', resetAfterPause);
    nativeCommand('tilt', true);
    reportSimulationReady(true);
    const timer = window.setInterval(() => {
      const now = time();
      const input = selectMotion(remote.current, local.current, now);
      const { demo, started, frozen } = mode.current;
      let sample = input.sample;
      if (demo !== 'live') {
        const elapsed = now - started;
        const activity = elapsed < 0.8 || (demo === 'mix' && elapsed > 8) ? 0.7 : 0;
        sample = { mixed: demo === 'mix' ? Math.min(1, Math.max(0, (elapsed - 10) / 10)) : 0.1, gyro: { x: Math.sin(elapsed * 3) * activity * 20, y: Math.cos(elapsed * 3) * activity * 15, z: Math.sin(elapsed) * activity * 12 }, activity, receivedAt: now };
      }
      sample = speed.current.sample(sample, demo === 'live' ? input.source : 'demo');
      const paused = document.hidden || isNativePaused();
      const intro = wake.current.frame(now);
      const introducing = demo === 'live' && intro.stage !== 'complete';
      if (introducing && intro.stage === 'waiting') {
        machine.current.reset();
      } else if (introducing && (intro.stage === 'orbit' || intro.stage === 'panels')) {
        machine.current.seekIntro(intro.stage === 'orbit' ? 'detected' : 'panels', intro.elapsed);
      }
      if (!paused && wake.current.takeCompletion() && demo === 'live' && !frozen) {
        machine.current.beginAfterWake({ skipIntro: true });
      }
      const shared = demo === 'live' && !frozen && input.source === 'bluetooth' ? remote.current?.story : null;
      const age = shared && remote.current ? Math.max(0, now - remote.current.receivedAt) : 0;
      const sharedElapsed = shared ? shared.elapsed + age : 0;
      const scenario = shared ? { stage: shared.stage, deadline: shared.deadline,
        remaining: Math.max(0, shared.remaining - age), countdown: countdownFrame(sharedElapsed).number ?? 0,
        countdownStart: countdownFrame(sharedElapsed).start,
        mixed: sample?.mixed ?? null, progress: sample?.mixed ?? null }
        : machine.current.step(now, paused || frozen || (introducing && intro.stage === 'waiting') ? null : sample);
      const scenarioElapsed = shared ? sharedElapsed : machine.current.stageElapsed;
      const viewIntro = demo !== 'live' || input.source === 'local' ? storyWakeFrame(scenario.stage, machine.current.stageElapsed) : intro;
      setView({ intro: viewIntro, scenarioElapsed, scenario: frozen ? scenarioPreview(frozen) : scenario, input: { ...input, sample: frozen ? null : sample }, demo, frozen });
    }, 1000 / 30);
    return () => {
      clearInterval(timer);
      reportSimulationReady(false);
      nativeCommand('tilt', false);
      window.removeEventListener('deviceorientation', orientation);
      window.removeEventListener('vitani-prvaku:power', resetAfterPause);
      document.removeEventListener('visibilitychange', resetAfterPause);
    };
  }, []);

  async function enableBrowserMotion() {
    try {
      const orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
      if (!orientation) { setSensorError('Tento prohlížeč nemá gyroskop. Použijte ukázku scénáře.'); return; }
      if (orientation.requestPermission && await orientation.requestPermission() !== 'granted') { setSensorError('Přístup k pohybu nebyl povolen.'); return; }
      setSensorError('');
    } catch { setSensorError('Gyroskop se nepodařilo povolit.'); }
  }
  function start(demo: Demo) {
    machine.current.reset();
    speed.current = new MotionSpeed();
    mode.current = { demo, started: time(), frozen: null };
  }
  function freeze(stage: ScenarioStage | null) {
    machine.current.reset();
    mode.current = { demo: 'live', started: 0, frozen: stage };
  }
  return { ...view, sensorError, enableBrowserMotion, start, freeze };
}
