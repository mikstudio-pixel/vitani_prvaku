'use client';

import { useEffect, useRef, type PointerEvent } from 'react';
import { HoldRepeat } from '@/lib/hold-repeat';
import { isNativePaused } from '@/lib/native-host';

export function CalibrationField({ id, label, unit, value, min, max, step, amount, adjust, setValue }: {
  id: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  amount: number;
  adjust: (delta: number) => void;
  setValue: (value: number) => void;
}) {
  const hold = useRef<HoldRepeat | null>(null);
  const pointer = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const stop = () => { hold.current?.stop(); hold.current = null; pointer.current = null; };
  useEffect(() => {
    const stop = () => { hold.current?.stop(); hold.current = null; pointer.current = null; };
    const hidden = () => { if (document.hidden || isNativePaused()) stop(); };
    window.addEventListener('blur', stop);
    window.addEventListener('vitani-prvaku:power', hidden);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      stop();
      window.removeEventListener('blur', stop);
      window.removeEventListener('vitani-prvaku:power', hidden);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [amount]);

  function start(event: PointerEvent<HTMLElement>, delta?: number) {
    if (!event.isPrimary || event.button !== 0 || pointer.current) return;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (delta !== undefined) {
      event.preventDefault();
      event.currentTarget.focus();
      hold.current = new HoldRepeat(() => adjust(delta));
      hold.current.start();
    } else suppressClick.current = false;
  }

  function end(event: PointerEvent<HTMLElement>) {
    if (pointer.current?.id !== event.pointerId) return;
    stop();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const release = { onPointerUp: end, onPointerCancel: end, onLostPointerCapture: end };
  return <div className="calibration-value">
    <button type="button" className="calibration-scrub" aria-label={`Zadat ${label}`} aria-controls={id}
      title="Táhni doprava pro zvýšení, doleva pro snížení. Klepnutím můžeš číslo zadat."
      onPointerDown={event => start(event)} {...release}
      onPointerMove={event => {
        const gesture = pointer.current;
        if (!gesture || gesture.id !== event.pointerId) return;
        const dx = event.clientX - gesture.x;
        if (!gesture.dragging) {
          if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(event.clientY - gesture.y)) return;
          gesture.dragging = true;
          suppressClick.current = true;
        }
        const steps = Math.trunc(dx / 4);
        if (steps) { gesture.x += steps * 4; adjust(steps * amount); }
      }}
      onClick={event => { if (!suppressClick.current || event.detail === 0) input.current?.focus(); }}
    >{label}<span>{unit} <span aria-hidden="true">↔</span></span></button>
    <button type="button" className="calibration-repeat" aria-label={`Snížit ${label}`}
      onPointerDown={event => start(event, -amount)} {...release}
      onClick={event => { if (event.detail === 0) adjust(-amount); }}>−</button>
    <input ref={input} id={id} aria-label={label} type="number" inputMode="decimal" min={min} max={max} step={step} value={value}
      aria-describedby="calibration-gestures" onChange={event => {
        const next = event.currentTarget.valueAsNumber;
        if (Number.isFinite(next)) setValue(next);
      }} />
    <button type="button" className="calibration-repeat" aria-label={`Zvýšit ${label}`}
      onPointerDown={event => start(event, amount)} {...release}
      onClick={event => { if (event.detail === 0) adjust(amount); }}>+</button>
  </div>;
}
