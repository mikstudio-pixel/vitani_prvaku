'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FluidBowl, WAVE_STRENGTH, WAVE_VISCOSITY, type FluidStats, type RimMode } from '@/lib/fluid';
import { CalibrationPanel, useDisplayCalibration } from '@/components/display-calibration';
import { APP_VERSION } from '@/lib/app-version';
import { clampTilt, type Tilt } from '@/lib/tilt';
import { registerPrototypeTools } from '@/lib/prototype-tools';
import { DeviceTilt, SENSORS_OFF } from '@/lib/device-tilt';
import { bindFrameRate } from '@/lib/frame-rate-settings';
import { usePortraitCamera } from '@/components/use-portrait-camera';
import { PortraitRing } from '@/components/portrait-ring';

const FLASH_SECONDS = .8;
type Phase = 'idle' | 'flash' | 'revealing' | 'holding' | 'dissolving';

export default function Home({ photoEnabled = true }: { photoEnabled?: boolean }) {
  const settings = useDisplayCalibration('center');
  const { x, y, scale } = settings.calibration;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bowlRef = useRef<HTMLButtonElement>(null);
  const engine = useRef<FluidBowl | null>(null);
  const device = useRef<DeviceTilt | null>(null);
  const pending = useRef<{ image: ImageData; at: number } | null>(null);
  const cancelHold = useRef(() => {});
  const pointer = useRef<number | null>(null);
  const liveTilt = useRef<Tilt>({ x: 0, y: 0 });
  const [operator, setOperator] = useState(() => new URLSearchParams(location.search).get('operator') === '1');
  const [phase, setPhase] = useState<Phase>('idle');
  const [flash, setFlash] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(document.hidden);
  const [error, setError] = useState('');
  const [quality, setQuality] = useState<'auto' | 'performance' | 'detail'>('auto');
  const [stats, setStats] = useState<FluidStats | null>(null);
  const [rimMode, setRimMode] = useState<RimMode>('curved');
  const [sensor, setSensor] = useState(SENSORS_OFF);
  const [waveStrength, setWaveStrength] = useState<number>(WAVE_STRENGTH.default);
  const [waveViscosity, setWaveViscosity] = useState<number>(WAVE_VISCOSITY.default);
  const waveSettings = useRef({ strength: waveStrength, viscosity: waveViscosity });
  const updateTilt = useCallback((value: Tilt) => {
    liveTilt.current = clampTilt(value); engine.current?.setTilt(liveTilt.current);
  }, []);
  const reset = useCallback(() => {
    cancelHold.current(); pending.current = null; pointer.current = null;
    setPhase('idle'); setFlash(null); engine.current?.reset();
  }, []);
  const capture = useCallback((image: ImageData) => {
    if (!engine.current?.running || engine.current.portraitActive || pending.current) return;
    pending.current = { image, at: performance.now() }; setPhase('flash'); setFlash(0);
  }, []);
  const photo = usePortraitCamera(photoEnabled && ready && !paused && !error && phase === 'idle', capture);
  useEffect(() => { cancelHold.current = photo.cancel; }, [photo.cancel]);
  const prepare = () => {
    photo.prepare();
    if (navigator.maxTouchPoints > 1 && window.DeviceOrientationEvent && sensor.phase !== 'active') void device.current?.start();
  };

  useEffect(() => {
    const input = new DeviceTilt(updateTilt, setSensor); device.current = input;
    return () => { input.dispose(); device.current = null; };
  }, [updateTilt]);
  useEffect(() => registerPrototypeTools(value => { device.current?.stop(); updateTilt(value); }, reset), [updateTilt, reset]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let bowl: FluidBowl | null = null;
    let unbind: (() => void) | undefined;
    const lost = (event: Event) => {
      event.preventDefault(); reset(); bowl?.dispose(); engine.current = null;
      setReady(false); setError('Grafika byla přerušena. Obnov aplikaci nebo změň režim.');
    };
    const visibility = () => {
      if (document.hidden) reset();
      bowl?.setPaused(document.hidden); setPaused(document.hidden);
    };
    const blur = () => {
      cancelHold.current(); pointer.current = null; updateTilt({ x: 0, y: 0 });
      if (pending.current) { pending.current = null; setPhase('idle'); setFlash(null); }
    };
    try {
      const params = new URLSearchParams(location.search);
      const profile = quality === 'auto' ? navigator.maxTouchPoints > 1 ? 'performance' : 'detail' : quality;
      bowl = new FluidBowl(canvas, { easterEgg: false, quality: profile, onStats: setStats, automaticCrests: true,
        stirring: params.get('stir') !== '0', dissolving: params.get('dissolve') !== '0',
        organicSeparation: params.get('organic') !== '0', ambientFlow: params.get('drift') !== '0' });
      engine.current = bowl;
      bowl.setWaveStrength(waveSettings.current.strength); bowl.setWaveViscosity(waveSettings.current.viscosity);
      bowl.setTilt(liveTilt.current); unbind = bindFrameRate(fps => bowl?.setFrameRate(fps));
      setError(''); setReady(true); visibility();
    } catch (cause) {
      setReady(false); setError(cause instanceof Error ? cause.message : 'Simulaci se nepodařilo spustit.');
    }
    canvas.addEventListener('webglcontextlost', lost);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur); window.addEventListener('pagehide', reset);
    return () => {
      pending.current = null; cancelHold.current(); unbind?.(); bowl?.dispose(); engine.current = null;
      canvas.removeEventListener('webglcontextlost', lost);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur); window.removeEventListener('pagehide', reset);
    };
  }, [quality, reset, updateTilt]);
  useEffect(() => { engine.current?.setRimMode(rimMode); }, [rimMode, quality, ready]);
  useEffect(() => {
    if (!ready || paused) return;
    let animation = 0;
    const tick = (now: number) => {
      const frame = pending.current;
      if (frame) {
        const elapsed = (now - frame.at) / 1000;
        if (elapsed < FLASH_SECONDS) setFlash(elapsed);
        else {
          pending.current = null; setFlash(null);
          try { engine.current?.setPortrait(frame.image); }
          catch (cause) { setError(cause instanceof Error ? cause.message : 'Fotografii se nepodařilo zobrazit.'); }
        }
      }
      setPhase(pending.current ? 'flash' : engine.current?.portraitPhase ?? 'idle');
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [ready, paused, quality]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.key.toLowerCase() === 'o') setOperator(value => !value);
      if (event.key.toLowerCase() === 'r') reset();
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [reset]);
  const release = () => { pointer.current = null; if (sensor.phase !== 'active') updateTilt({ x: 0, y: 0 }); };
  const move = (clientX: number, clientY: number) => {
    const box = bowlRef.current?.getBoundingClientRect();
    if (box) updateTilt({ x: ((clientX - box.left) / box.width - .5) * 2.25, y: ((clientY - box.top) / box.height - .5) * 2.25 });
  };

  return <main className="installation" data-portrait={phase} data-camera={photo.state.phase} data-version={APP_VERSION}>
    {/* Keep the video mounted and playing when the operator closes setup. */}
    <video ref={photo.videoRef} muted playsInline className={operator ? 'camera-preview' : 'camera-source'} aria-label="Náhled kamery pro obsluhu" aria-hidden={!operator} />
    {operator && <>
      <CalibrationPanel display="center" {...settings} />
      <section className="portrait-operator" aria-label="Nastavení obsluhy">
        <p>{photo.captureError || photo.state.message}</p>
        {error && <p role="alert">{error}</p>}
        {sensor.phase === 'error' && <p>{sensor.message}</p>}
        <button type="button" onClick={prepare} disabled={photo.state.phase === 'preparing'}>Připravit kameru</button>
        <button type="button" onClick={photo.stop}>Vypnout kameru</button>
        <button type="button" onClick={reset}>Nový návštěvník</button>
        <button type="button" onClick={() => setOperator(false)}>Skrýt obsluhu</button>
        <label>Režim <select value={quality} onChange={event => { reset(); setStats(null); setQuality(event.target.value as typeof quality); }}>
          <option value="auto">Automaticky</option><option value="performance">Úsporný</option><option value="detail">Detailní</option>
        </select></label>
        <label>Vlny <input type="range" min={WAVE_STRENGTH.min} max={WAVE_STRENGTH.max} step={WAVE_STRENGTH.step} value={waveStrength} onChange={event => {
          const value = event.currentTarget.valueAsNumber; setWaveStrength(value); waveSettings.current.strength = value; engine.current?.setWaveStrength(value);
        }} /></label>
        <label>Viskozita <input type="range" min={WAVE_VISCOSITY.min} max={WAVE_VISCOSITY.max} step={WAVE_VISCOSITY.step} value={waveViscosity} onChange={event => {
          const value = event.currentTarget.valueAsNumber; setWaveViscosity(value); waveSettings.current.viscosity = value; engine.current?.setWaveViscosity(value);
        }} /></label>
        <label>Okraj <select value={rimMode} onChange={event => setRimMode(event.target.value as RimMode)}>
          <option value="curved">Plynulý</option><option value="under">Pod okrajem</option><option value="hybrid">Kompromis</option><option value="edge">U okraje</option>
        </select></label>
        {stats && <p>{stats.fps} FPS</p>}
      </section>
    </>}
    <button ref={bowlRef} type="button" className="bowl" disabled={!ready} style={{ transform: `translate(${x}px, ${y}px) scale(${scale})` }}
      aria-label="Podrž prst jednu sekundu pro portrét v kapalině."
      onPointerDown={event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
        if (photoEnabled && photo.state.phase !== 'ready') { prepare(); return; }
        photo.down(event.pointerId, event.clientX, event.clientY);
        if (event.pointerType === 'mouse' && pointer.current === null) pointer.current = event.pointerId;
      }}
      onPointerMove={event => {
        photo.move(event.pointerId, event.clientX, event.clientY);
        if (event.pointerId === pointer.current && sensor.phase !== 'active') move(event.clientX, event.clientY);
      }}
      onPointerUp={event => { photo.up(event.pointerId); if (event.pointerId === pointer.current) release(); }}
      onPointerCancel={() => { photo.cancel(); release(); }}
      onLostPointerCapture={event => { photo.up(event.pointerId); if (event.pointerId === pointer.current) release(); }}
      onBlur={() => { photo.cancel(); release(); }} onContextMenu={event => event.preventDefault()}
      onDoubleClick={() => device.current?.calibrate()}
      onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') photo.up(-1); }}
      onKeyDown={event => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          if (!event.repeat) { if (photo.state.phase !== 'ready') prepare(); else photo.down(-1); }
        }
        const directions: Record<string, Tilt> = { ArrowLeft: { x: -.13, y: 0 }, ArrowRight: { x: .13, y: 0 }, ArrowUp: { x: 0, y: -.13 }, ArrowDown: { x: 0, y: .13 } };
        const direction = directions[event.key];
        if (direction && sensor.phase !== 'active') { event.preventDefault(); updateTilt({ x: liveTilt.current.x + direction.x, y: liveTilt.current.y + direction.y }); }
        if (event.key === 'Escape') { photo.cancel(); device.current?.stop(); release(); }
      }}>
      <span className="fluid-window" data-rim-mode={rimMode}><canvas ref={canvasRef} className="fluid-canvas" aria-label="Živá simulace světlé a tmavé kapaliny" /></span>
      <PortraitRing progress={photo.progress} flash={flash} />
    </button>
  </main>;
}
