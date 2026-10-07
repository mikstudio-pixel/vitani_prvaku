'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FluidBowl, WAVE_STRENGTH, WAVE_VISCOSITY, type FluidStats, type RimMode } from '@/lib/fluid';
import { AppRefresh } from '@/components/app-refresh';
import { DisplaySwitcher } from '@/components/display-switcher';
import { CalibrationPanel, useDisplayCalibration } from '@/components/display-calibration';
import { APP_VERSION } from '@/lib/app-version';
import { clampTilt, type Tilt } from '@/lib/tilt';
import { registerPrototypeTools } from '@/lib/prototype-tools';
import { DeviceTilt, SENSORS_OFF, type SensorState } from '@/lib/device-tilt';
import { FluidReadout } from '@/components/fluid-readout';
import type { FluidTelemetry } from '@/lib/fluid-telemetry';
import { completeSession, completeSimulation, isNativeHost, isNativePaused, publishTrayState, reportSimulationReady } from '@/lib/native-host';
import { storyWakeFrame, WakeIntro } from '@/lib/wake-intro';
import { TiltRing } from '@/components/tilt-ring';
import { MixingIndicatorDot, MixingPrompt } from '@/components/mixing-indicator';
import { MixingIndicator, INDICATOR_READY } from '@/lib/mixing-indicator';
import { lightFromTilt } from '@/lib/tilt-light';
import { bindMixingSensitivity } from '@/lib/mixing-settings';
import { bindQrAnimation } from '@/lib/qr-settings';
import { bindFrameRate } from '@/lib/frame-rate-settings';
import { bindIntroSettings } from '@/lib/intro-settings';
import { SimulationRun } from '@/lib/simulation-mode';
import { InstallationAudio, bindInstallationAudio } from '@/lib/installation-audio';
import { visualMixingProgress } from '@/lib/mixing-scenario';

export default function Home({ sidePreview = false }: { sidePreview?: boolean }) {
  useEffect(() => bindIntroSettings(), []);
  const calibrationSettings = useDisplayCalibration('center');
  const indicatorSettings = useDisplayCalibration('indicator');
  const indicator = useRef(new MixingIndicator());
  const audio = useRef<InstallationAudio | null>(null);
  useEffect(() => {
    const player = new InstallationAudio('center');
    audio.current = player;
    const unbind = bindInstallationAudio(player);
    return () => { audio.current = null; unbind(); };
  }, []);
  const simulation = useRef<SimulationRun | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [indicatorFrame, setIndicatorFrame] = useState(INDICATOR_READY);
  const nativeActivity = useRef<{ value: number; quiet?: number; at: number } | null>(null);
  const { x, y, scale } = calibrationSettings.calibration;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FluidBowl | null>(null);
  const deviceTiltRef = useRef<DeviceTilt | null>(null);
  const bowlRef = useRef<HTMLButtonElement>(null);
  const activePointer = useRef<number | null>(null);
  const pointerType = useRef('');
  const liveTilt = useRef<Tilt>({ x: 0, y: 0 });
  const finaleDirection = useRef(1);
  const waveSettings = useRef({ strength: WAVE_STRENGTH.default as number, viscosity: WAVE_VISCOSITY.default as number });
  const initialized = useRef(false);
  const wake = useRef(new WakeIntro());
  const [intro, setIntro] = useState(() => new WakeIntro().frame(0));
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [easterEggActive, setEasterEggActive] = useState(false);
  const [rimMode, setRimMode] = useState<RimMode>('curved');
  const [waveStrength, setWaveStrength] = useState<number>(WAVE_STRENGTH.default);
  const [waveViscosity, setWaveViscosity] = useState<number>(WAVE_VISCOSITY.default);
  const [quality, setQuality] = useState<'auto' | 'performance' | 'detail'>('auto');
  const [stats, setStats] = useState<FluidStats | null>(null);
  const [telemetry, setTelemetry] = useState<FluidTelemetry | null>(null);
  const [sensor, setSensor] = useState<SensorState>(SENSORS_OFF);
  const sensorEngaged = sensor.phase !== 'off' && sensor.phase !== 'error';
  const updateTilt = useCallback((next: Tilt) => {
    if (simulation.current) return;
    const value = clampTilt(next);
    liveTilt.current = value;
    engineRef.current?.setTilt(value);
  }, []);
  const resetPortion = useCallback(({ waitForLift = false, render = false }: { waitForLift?: boolean; render?: boolean } = {}) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setPhysicsPaused(true);
    engine.reset({ render });
    indicator.current.reset({ waitForLift });
    audio.current?.reset();
    nativeActivity.current = null;
    setEasterEggActive(false);
    setIndicatorFrame(INDICATOR_READY);
  }, []);
  const release = () => {
    activePointer.current = null;
    if (!sensorEngaged) updateTilt({ x: 0, y: 0 });
  };
  const movePointer = (clientX: number, clientY: number) => {
    const box = bowlRef.current?.getBoundingClientRect();
    if (box) updateTilt({ x: ((clientX - box.left) / box.width - 0.5) * 2.25, y: ((clientY - box.top) / box.height - 0.5) * 2.25 });
  };

  useEffect(() => {
    const device = new DeviceTilt(updateTilt, setSensor);
    deviceTiltRef.current = device;
    if (isNativeHost()) void device.start();
    return () => { device.dispose(); deviceTiltRef.current = null; };
  }, [updateTilt]);

  useEffect(() => registerPrototypeTools(
    (value) => { deviceTiltRef.current?.stop(); updateTilt(value); },
    () => { if (!engineRef.current || error) throw new Error('Simulace není připravená.'); resetPortion({ render: true }); },
  ), [error, updateTilt, resetPortion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: FluidBowl | null = null;
    let unbindMixing: (() => void) | undefined;
    let unbindQr: (() => void) | undefined;
    let unbindFrameRate: (() => void) | undefined;
    let wasSleeping: boolean | null = null;
    const simulate = (event: Event) => {
      const enabled = (event as CustomEvent).detail;
      if (typeof enabled !== 'boolean' || !engine) return;
      simulation.current = enabled ? new SimulationRun() : null;
      setSimulating(enabled);
      liveTilt.current = { x: 0, y: 0 }; engine.setTilt(liveTilt.current);
      resetPortion();
      if (!enabled && !isNativePaused()) wake.current.start(performance.now() / 1000);
      event.preventDefault();
    };
    const lost = (event: Event) => {
      unbindMixing?.();
      unbindQr?.();
      unbindFrameRate?.();
      event.preventDefault(); engine?.dispose(); setReady(false);
      engineRef.current = null;
      simulation.current = null; setSimulating(false); reportSimulationReady(false);
      deviceTiltRef.current?.stop();
      setError('Grafika byla přerušena. Obnov aplikaci.');
    };
    const blurred = () => {
      activePointer.current = null; updateTilt({ x: 0, y: 0 });
    };
    const powerChanged = () => {
      const sleeping = document.hidden || isNativePaused();
      if (sleeping !== wasSleeping) engine?.setPaused(true);
      if (sleeping) {
        simulation.current = null; setSimulating(false);
        blurred(); wake.current.sleep();
      }
      if (sleeping !== wasSleeping) {
        // Scenario and liquid always reset together, before any resumed frame.
        resetPortion();
        if (!sleeping) wake.current.start(performance.now() / 1000);
      }
      engine?.setPaused(sleeping); setPaused(sleeping);
      wasSleeping = sleeping;
      setIntro(wake.current.frame(performance.now() / 1000));
    };
    try {
      const params = new URLSearchParams(window.location.search);
      const resolution = params.get('sim') === '160' ? 160 : params.get('sim') === '192' ? 192 : params.get('sim') === '256' ? 256 : params.get('sim') === '384' ? 384 : undefined;
      const profile = quality === 'auto' ? (navigator.maxTouchPoints > 1 ? 'performance' : 'detail') : quality;
      if (!initialized.current) {
        waveSettings.current.strength = params.get('waves') === 'original' ? WAVE_STRENGTH.min : WAVE_STRENGTH.default;
        initialized.current = true;
      }
      engine = new FluidBowl(canvas, {
        native: isNativeHost(),
        easterEgg: false,
        resolution, materialResolution: params.get('material') === '512' ? 512 : params.get('material') === '384' ? 384 : undefined, quality: profile, onStats: setStats, onTelemetry: setTelemetry, automaticCrests: true,
        stirring: params.get('stir') !== '0', dissolving: params.get('dissolve') !== '0',
        organicSeparation: params.get('organic') !== '0', ambientFlow: params.get('drift') !== '0',
        boundary: params.get('boundary') === 'previous' ? 'previous' : 'merged',
        waves: params.get('waves') === 'original' ? 'original' : 'higher',
      });
      engine.setPhysicsPaused(true);
      engine.setWaveStrength(waveSettings.current.strength);
      engine.setWaveViscosity(waveSettings.current.viscosity);
      engine.setTilt(liveTilt.current);
      engineRef.current = engine;
      unbindMixing = bindMixingSensitivity(value => engine?.setMixingSensitivity(value));
      unbindQr = bindQrAnimation(value => engine?.setQrAnimation(value));
      unbindFrameRate = bindFrameRate(fps => engine?.setFrameRate(fps));
      // eslint-disable-next-line react/react-compiler -- Match the control to the initial URL setting used by the external engine.
      setWaveStrength(waveSettings.current.strength);
      // eslint-disable-next-line react/react-compiler -- Reflect initialization of the external WebGL engine.
      setReady(true);
      reportSimulationReady(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Simulaci se nepodařilo spustit.');
    }
    canvas.addEventListener('webglcontextlost', lost);
    window.addEventListener('blur', blurred);
    window.addEventListener('michas:power', powerChanged);
    window.addEventListener('michas:simulation', simulate);
    document.addEventListener('visibilitychange', powerChanged);
    powerChanged();
    return () => {
      unbindMixing?.();
      unbindQr?.();
      unbindFrameRate?.();
      engine?.dispose(); engineRef.current = null;
      simulation.current = null; setSimulating(false); reportSimulationReady(false);
      canvas.removeEventListener('webglcontextlost', lost);
      window.removeEventListener('blur', blurred);
      window.removeEventListener('michas:power', powerChanged);
      window.removeEventListener('michas:simulation', simulate);
      document.removeEventListener('visibilitychange', powerChanged);
    };
  }, [quality, updateTilt, resetPortion]);

  useEffect(() => { engineRef.current?.setRimMode(rimMode); }, [rimMode, ready, quality]);

  useEffect(() => {
    if (!ready || paused) return;
    let animation = 0, stage = '';
    const tick = (now: number) => {
      const frame = wake.current.frame(now / 1000);
      if (stage !== frame.stage) { setIntro(frame); stage = frame.stage; }
      if (frame.stage === 'orbit' || frame.stage === 'panels') animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [ready, paused, quality]);

  useEffect(() => {
    if (paused) return;
    const publish = () => {
      const engine = engineRef.current;
      setEasterEggActive(engine?.easterEggActive ?? false);
      if (!engine || !ready || !engine.running || error || (sensor.phase === 'error' && !simulation.current)) {
        audio.current?.stop();
        setIndicatorFrame(indicator.current.step(performance.now() / 1000, null));
        publishTrayState({ phase: 'unavailable', tiltX: 0, tiltY: 0, activity: 0, oil: 0, elapsed: 0 });
        return;
      }
      const now = performance.now();
      const state = { ...engine.getTrayState(), light: lightFromTilt(liveTilt.current), quiet: undefined as number | undefined, story: undefined as import('@/lib/native-host').StoryClock | undefined }, frame = wake.current.frame(now / 1000);
      if (isNativeHost()) state.activity = nativeActivity.current && now - nativeActivity.current.at < 1000 ? nativeActivity.current.value : 0;
      if (isNativeHost() && nativeActivity.current?.quiet != null && now - nativeActivity.current.at < 1000) state.quiet = nativeActivity.current.quiet + (now - nativeActivity.current.at) / 1000;
      const run = simulation.current;
      if (run) {
        Object.assign(state, run.sample(now / 1000, indicator.current.storyFrame.stage));
        liveTilt.current = { x: state.tiltX, y: state.tiltY };
        state.light = lightFromTilt(liveTilt.current);
        engine.setTilt(liveTilt.current);
      }
      // Keep the opening question through the side-panel ignition, then show ready.
      const previousStage = indicator.current.storyFrame.stage;
      const next = indicator.current.step(now / 1000, state, frame);
      const story = indicator.current.storyFrame;
      state.story = story;
      if (previousStage !== 'standby' && story.stage === 'standby' && isNativeHost()) {
        if (run?.complete('standby')) completeSimulation();
        else completeSession();
        return; // Native captures the outgoing screen before resetting the web UI.
      }
      engine.setFinaleStirring(story.stage === 'finishing');
      finaleDirection.current = engine.finaleRotationDirection;
      engine.setPhysicsPaused(frame.stage === 'waiting' || indicator.current.physicsPaused);
      audio.current?.update({ ...story, activity: state.activity, progress: visualMixingProgress(state.mixed ?? null), available: true });
      if (previousStage !== 'standby' && indicator.current.storyFrame.stage === 'standby') {
        resetPortion({ waitForLift: true });
        Object.assign(state, engine.getTrayState());
      }
      if (indicator.current.qrReady) engine.revealQr();
      else if (next.phase === 'ready') engine.releaseQr();
      setIndicatorFrame(previous => previous.phase === next.phase && previous.progress === next.progress && previous.prompt === next.prompt ? previous : next);
      if (run?.complete(indicator.current.storyFrame.stage)) {
        completeSimulation();
        return;
      }
      const broadcastIntro = frame.stage === 'complete'
        ? storyWakeFrame(indicator.current.storyFrame.stage, indicator.current.storyFrame.elapsed) : frame;
      // V4 carries the actual calibrated tilt signal together with gyro/fluid data.
      // Intro phase time replaces mixing while the story is waiting.
      publishTrayState(broadcastIntro.stage === 'orbit' || broadcastIntro.stage === 'panels'
        ? { ...state, phase: broadcastIntro.stage === 'orbit' ? 'waking' : 'introducing', elapsed: broadcastIntro.elapsed, mixed: null }
        : state);
    };
    publish();
    if (!ready) return;
    const timer = window.setInterval(publish, 1000 / 30);
    return () => window.clearInterval(timer);
  }, [ready, paused, error, sensor.phase, quality, resetPortion]);

  return (
    <main className="installation" data-version={APP_VERSION} data-wake-stage={intro.stage} data-easter-egg={easterEggActive ? 'bob' : undefined}>
      {!isNativeHost() && <><AppRefresh /><DisplaySwitcher current="center" sidePreview={sidePreview} /></>}
      <CalibrationPanel display="center" {...calibrationSettings} indicator={indicatorSettings} />
      <details className="simulation-panel installation-panel" data-operator-ui>
        <summary>Živé hodnoty</summary>
        <FluidReadout value={ready && !error ? telemetry : null} />
      </details>
      <details className="controls-panel installation-panel" data-operator-ui>
        <summary>Nastavení</summary>
        <div className="wave-control">
          <label htmlFor="wave-strength">Vlny <output htmlFor="wave-strength">{waveStrength.toFixed(2).replace('.', ',')}×</output></label>
          <input
            id="wave-strength" type="range" min={WAVE_STRENGTH.min} max={WAVE_STRENGTH.max} step={WAVE_STRENGTH.step}
            value={waveStrength} disabled={!ready} aria-valuetext={`${waveStrength.toFixed(2).replace('.', ',')} násobek původní síly`}
            onChange={(event) => {
              const value = event.currentTarget.valueAsNumber;
              waveSettings.current.strength = value; setWaveStrength(value); engineRef.current?.setWaveStrength(value);
            }}
          />
          <label htmlFor="wave-viscosity" title="Vyšší viskozita zjemňuje drobné vlny a rozšiřuje hřebeny.">Viskozita <output htmlFor="wave-viscosity">{waveViscosity.toFixed(1).replace('.', ',')}×</output></label>
          <input
            id="wave-viscosity" type="range" min={WAVE_VISCOSITY.min} max={WAVE_VISCOSITY.max} step={WAVE_VISCOSITY.step}
            value={waveViscosity} disabled={!ready} aria-valuetext={`${waveViscosity.toFixed(1).replace('.', ',')} násobek původní viskozity`}
            onChange={(event) => {
              const value = event.currentTarget.valueAsNumber;
              waveSettings.current.viscosity = value; setWaveViscosity(value); engineRef.current?.setWaveViscosity(value);
            }}
          />
          <label className="quality-control" htmlFor="fluid-quality">Režim
            <select id="fluid-quality" value={quality} title="Změna režimu připraví novou porci; hodnoty sliderů zůstanou." onChange={(event) => {
              setStats(null); setQuality(event.currentTarget.value as typeof quality);
            }}>
              <option value="auto">Automaticky</option><option value="performance">Úsporný</option><option value="detail">Detailní</option>
            </select>
          </label>
          <output className="performance-status" aria-live="off">{stats ? `${stats.fps} FPS · ${stats.quality === 'performance' ? 'úsporný' : 'detailní'}` : 'Měřím FPS…'}</output>
        </div>
        <fieldset className="rim-switcher" aria-label="Okraj hladiny" disabled={!ready}>
          <button type="button" aria-pressed={rimMode === 'curved'} onClick={() => setRimMode('curved')}>Plynulý okraj</button>
          <button type="button" aria-pressed={rimMode === 'under'} onClick={() => setRimMode('under')}>Pod okrajem</button>
          <button type="button" aria-pressed={rimMode === 'hybrid'} onClick={() => setRimMode('hybrid')}>Kompromis</button>
          <button type="button" aria-pressed={rimMode === 'edge'} onClick={() => setRimMode('edge')}>U okraje</button>
        </fieldset>
      </details>
      <button
        ref={bowlRef} type="button" className="bowl" disabled={!ready}
        style={{ transform: `translate(${x}px, ${y}px) scale(${scale})` }}
        aria-label="Interaktivní mísa kaše. Klepnutím zapni pohyb iPadu, dvojím klepnutím nastav rovinu. Myší táhni po míse nebo použij šipky."
        onClick={() => {
          // Keep the iOS permission request directly inside the user gesture.
          if (!sensorEngaged && pointerType.current !== 'mouse') void deviceTiltRef.current?.start();
        }}
        onDoubleClick={() => { if (sensor.phase === 'active') deviceTiltRef.current?.calibrate(); }}
        onPointerDown={(event) => {
          pointerType.current = event.pointerType;
          if (sensorEngaged || (event.pointerType === 'mouse' && event.button !== 0) || activePointer.current !== null) return;
          // Touch starts motion through click; a desktop mouse controls the tray directly.
          if (event.pointerType !== 'mouse' && window.DeviceOrientationEvent) return;
          event.preventDefault(); activePointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus();
          movePointer(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => { if (event.pointerId === activePointer.current) movePointer(event.clientX, event.clientY); }}
        onPointerUp={(event) => { if (event.pointerId === activePointer.current) release(); }}
        onPointerCancel={release} onLostPointerCapture={release} onBlur={release}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') pointerType.current = '';
          const directions: Record<string, Tilt> = { ArrowLeft: { x: -0.13, y: 0 }, ArrowRight: { x: 0.13, y: 0 }, ArrowUp: { x: 0, y: -0.13 }, ArrowDown: { x: 0, y: 0.13 } };
          const direction = directions[event.key];
          if (direction && !sensorEngaged) { event.preventDefault(); updateTilt({ x: liveTilt.current.x + direction.x, y: liveTilt.current.y + direction.y }); }
          if (event.key === 'Escape') { event.preventDefault(); deviceTiltRef.current?.stop(); updateTilt({ x: 0, y: 0 }); }
          if (event.key.toLowerCase() === 'c') deviceTiltRef.current?.calibrate();
          if (event.key.toLowerCase() === 'o') deviceTiltRef.current?.rotateAxes();
          if (event.key.toLowerCase() === 'r') resetPortion({ render: true });
        }}
      >
        <span className="fluid-window" data-rim-mode={rimMode}>
          <canvas ref={canvasRef} className="fluid-canvas" aria-label="Světlá a tmavá kapalina se mícháním postupně spojují." />
          {!paused && !easterEggActive && <MixingPrompt frame={indicatorFrame} />}
        </span>
        <TiltRing tilt={liveTilt} wake={wake} story={indicator} finaleDirection={finaleDirection} running={ready && !paused && !error} />
      </button>
      <MixingIndicatorDot frame={indicatorFrame} calibration={indicatorSettings.calibration} paused={paused} />
      {error && <p className="installation-error" data-operator-ui role="alert">{error}</p>}
      {!error && !simulating && sensor.phase === 'error' && <p className="installation-error" data-operator-ui role="alert">{sensor.message} Klepnutím na mísu zkus přístup znovu.</p>}
      <output className="sr-only">{!ready ? 'Připravuji porci.' : sensorEngaged ? sensor.message : 'Klepni na mísu a povol pohyb. Myší můžeš táhnout přímo po míse.'}</output>
    </main>
  );
}
