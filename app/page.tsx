'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FluidBowl } from '@/lib/fluid';
import { APP_VERSION } from '@/lib/app-version';
import { clampTilt, type Tilt } from '@/lib/tilt';
import { registerPrototypeTools } from '@/lib/prototype-tools';
import { DeviceTilt, SENSORS_OFF } from '@/lib/device-tilt';
import { usePortraitCamera } from '@/components/use-portrait-camera';
import { PortraitRing } from '@/components/portrait-ring';

const FLASH_SECONDS = .8;
type Phase = 'idle' | 'flash' | 'revealing' | 'holding' | 'dissolving';

export default function Home({ photoEnabled = true }: { photoEnabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bowlRef = useRef<HTMLButtonElement>(null);
  const engine = useRef<FluidBowl | null>(null);
  const device = useRef<DeviceTilt | null>(null);
  const pending = useRef<{ image: ImageData; at: number } | null>(null);
  const cancelHold = useRef(() => {});
  const touchPointer = useRef<number | null>(null);
  const contacts = useRef(new Set<number>());
  const liveTilt = useRef<Tilt>({ x: 0, y: 0 });
  const [phase, setPhase] = useState<Phase>('idle');
  const [flash, setFlash] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(document.hidden);
  const [error, setError] = useState('');
  const [sensor, setSensor] = useState(SENSORS_OFF);
  const updateTilt = useCallback((value: Tilt) => {
    liveTilt.current = clampTilt(value); engine.current?.setTilt(liveTilt.current);
  }, []);
  const stopTouch = useCallback(() => {
    touchPointer.current = null; engine.current?.setTouchAt(null);
  }, []);
  const cancelTouch = useCallback(() => { contacts.current.clear(); stopTouch(); }, [stopTouch]);
  const reset = useCallback(() => {
    cancelHold.current(); cancelTouch(); pending.current = null;
    setPhase('idle'); setFlash(null); engine.current?.reset();
  }, [cancelTouch]);
  const capture = useCallback((image: ImageData) => {
    if (!engine.current?.running || engine.current.portraitActive || pending.current) return;
    stopTouch();
    pending.current = { image, at: performance.now() }; setPhase('flash'); setFlash(0);
  }, [stopTouch]);
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
    const lost = (event: Event) => {
      event.preventDefault(); reset(); bowl?.dispose(); engine.current = null;
      setReady(false); setError('Grafika byla přerušena. Obnov aplikaci.');
    };
    const visibility = () => {
      if (document.hidden) reset();
      bowl?.setPaused(document.hidden); setPaused(document.hidden);
    };
    const blur = () => {
      cancelHold.current(); cancelTouch(); updateTilt({ x: 0, y: 0 });
      if (pending.current) { pending.current = null; setPhase('idle'); setFlash(null); }
    };
    try {
      const params = new URLSearchParams(location.search);
      const profile = navigator.maxTouchPoints > 1 ? 'performance' : 'detail';
      bowl = new FluidBowl(canvas, { easterEgg: false, quality: profile, automaticCrests: true,
        stirring: params.get('stir') !== '0', dissolving: params.get('dissolve') !== '0',
        organicSeparation: params.get('organic') !== '0', ambientFlow: params.get('drift') !== '0' });
      engine.current = bowl;
      bowl.setTilt(liveTilt.current);
      setError(''); setReady(true); visibility();
    } catch (cause) {
      setReady(false); setError(cause instanceof Error ? cause.message : 'Simulaci se nepodařilo spustit.');
    }
    canvas.addEventListener('webglcontextlost', lost);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur); window.addEventListener('pagehide', reset);
    return () => {
      pending.current = null; cancelHold.current(); cancelTouch(); bowl?.dispose(); engine.current = null;
      canvas.removeEventListener('webglcontextlost', lost);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur); window.removeEventListener('pagehide', reset);
    };
  }, [reset, updateTilt, cancelTouch]);
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
  }, [ready, paused]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.key.toLowerCase() === 'r') reset();
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [reset]);
  const attract = (clientX: number, clientY: number) => {
    const box = canvasRef.current?.getBoundingClientRect();
    if (box && box.width > 0 && box.height > 0) engine.current?.setTouchAt({ x: (clientX - box.left) / box.width, y: 1 - (clientY - box.top) / box.height });
  };
  const beginTouch = (id: number, clientX: number, clientY: number) => {
    contacts.current.add(id);
    if (contacts.current.size !== 1 || phase !== 'idle' || pending.current || engine.current?.portraitActive) { stopTouch(); return; }
    touchPointer.current = id; attract(clientX, clientY);
  };
  const endTouch = (id: number) => {
    contacts.current.delete(id); photo.up(id);
    if (touchPointer.current === id) stopTouch();
  };

  return <main className="installation" data-portrait={phase} data-camera={photo.state.phase} data-version={APP_VERSION}>
    <output className="app-version" title={APP_VERSION} aria-label={`Verze aplikace ${APP_VERSION}`}>
      v {APP_VERSION === 'development' ? 'vývoj' : APP_VERSION.slice(0, 7)}
    </output>
    <video ref={photo.videoRef} muted playsInline className="camera-source" aria-hidden="true" />
    <button ref={bowlRef} type="button" className="bowl" disabled={!ready}
      aria-label="Podrž prst jednu sekundu pro portrét v kapalině."
      onPointerDown={event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
        beginTouch(event.pointerId, event.clientX, event.clientY);
        if (photoEnabled && photo.state.phase !== 'ready') { prepare(); return; }
        photo.down(event.pointerId, event.clientX, event.clientY);
      }}
      onPointerMove={event => {
        photo.move(event.pointerId, event.clientX, event.clientY);
        if (event.pointerId === touchPointer.current) attract(event.clientX, event.clientY);
      }}
      onPointerUp={event => endTouch(event.pointerId)}
      onPointerCancel={() => { photo.cancel(); cancelTouch(); }}
      onLostPointerCapture={event => endTouch(event.pointerId)}
      onBlur={() => { photo.cancel(); cancelTouch(); }} onContextMenu={event => event.preventDefault()}
      onDoubleClick={() => device.current?.calibrate()}
      onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') endTouch(-1); }}
      onKeyDown={event => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          if (!event.repeat) {
            const box = canvasRef.current?.getBoundingClientRect();
            if (box) beginTouch(-1, box.left + box.width / 2, box.top + box.height / 2);
            if (photo.state.phase !== 'ready') prepare(); else photo.down(-1);
          }
        }
        const directions: Record<string, Tilt> = { ArrowLeft: { x: -.13, y: 0 }, ArrowRight: { x: .13, y: 0 }, ArrowUp: { x: 0, y: -.13 }, ArrowDown: { x: 0, y: .13 } };
        const direction = directions[event.key];
        if (direction && sensor.phase !== 'active') { event.preventDefault(); updateTilt({ x: liveTilt.current.x + direction.x, y: liveTilt.current.y + direction.y }); }
        if (event.key === 'Escape') { photo.cancel(); cancelTouch(); device.current?.stop(); updateTilt({ x: 0, y: 0 }); }
      }}>
      <span className="fluid-window" data-rim-mode="curved"><canvas ref={canvasRef} className="fluid-canvas" aria-label="Živá simulace světlé a tmavé kapaliny" /></span>
      <PortraitRing progress={photo.progress} flash={flash} />
    </button>
  </main>;
}
