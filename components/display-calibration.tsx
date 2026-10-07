'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { calibrationKey, DISPLAY_DEFAULTS, normalizeCalibration, readCalibration, type DisplayCalibration, type CalibrationRole, type DisplayRole } from '@/lib/display-calibration';
import { isNativeHost, reportCalibration, setRemoteCalibration, type RemoteCalibration, type TraySync } from '@/lib/native-host';
import { CalibrationField } from './calibration-field';
import './display-calibration.css';

type CalibrationUpdate = (value: DisplayCalibration | ((current: DisplayCalibration) => DisplayCalibration)) => void;

const syncSnapshot = () => window.__michasNative?.sync;
const subscribeSync = (callback: () => void) => {
  window.addEventListener('michas:sync', callback);
  return () => window.removeEventListener('michas:sync', callback);
};

export function useDisplayCalibration(role: CalibrationRole) {
  const [calibration, setCalibration] = useState(() => ({ ...DISPLAY_DEFAULTS[role] }));
  const [saved, setSaved] = useState(true);
  const current = useRef(calibration);
  const apply = useCallback((value: DisplayCalibration, request = 0) => {
    const next = normalizeCalibration(value);
    current.current = next;
    setCalibration(next);
    let stored = true;
    try { localStorage.setItem(calibrationKey(role), JSON.stringify(next)); }
    catch { stored = false; }
    setSaved(stored);
    reportCalibration(role, next, stored, request);
  }, [role]);
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(calibrationKey(role)); }
    catch { /* Storage can be disabled; retain the default position. */ }
    // eslint-disable-next-line react/react-compiler -- Restore device storage after SSR hydration.
    apply(readCalibration(role, stored));
    let received = 0;
    const receive = () => {
      const sync = window.__michasNative?.sync;
      const command = sync?.calibrationCommand;
      if (sync?.role !== role || !command || command.request === received) return;
      received = command.request;
      apply(command.value, command.request);
    };
    const unsubscribe = subscribeSync(receive);
    const remote = (event: Event) => {
      const detail = (event as CustomEvent<{ target: string; value: DisplayCalibration }>).detail;
      if (detail?.target === role) apply(detail.value);
    };
    window.addEventListener('michas:admin-calibration', remote);
    receive();
    return () => { unsubscribe(); window.removeEventListener('michas:admin-calibration', remote); };
  }, [role, apply]);
  const update: CalibrationUpdate = value => apply(typeof value === 'function' ? value(current.current) : value);
  return { calibration, update, saved };
}

function CalibrationValues({ role, calibration, update, step }: {
  role: CalibrationRole; calibration: DisplayCalibration; update: CalibrationUpdate; step: number;
}) {
  const adjust = (key: keyof DisplayCalibration, delta: number) => update(current => ({ ...current, [key]: current[key] + delta }));
  return <fieldset className="calibration-fields">
    {(['x', 'y', 'scale'] as const).map(key => {
      const isScale = key === 'scale';
      return <CalibrationField key={key} id={`calibration-${key}`} label={isScale ? 'Velikost' : key.toUpperCase()} unit={isScale ? '%' : 'px'}
        value={isScale ? Math.round(calibration.scale * 1000) / 10 : calibration[key]}
        min={isScale ? 10 : -3000} max={isScale ? 400 : 3000} step={isScale ? 0.1 : 1}
        amount={isScale ? step / 1000 : step} adjust={delta => adjust(key, delta)}
        setValue={n => update(current => ({ ...current, [key]: isScale ? n / 100 : n }))} />;
    })}
    <button className="calibration-reset" onClick={() => update({ ...DISPLAY_DEFAULTS[role] })}>Obnovit výchozí polohu a velikost</button>
  </fieldset>;
}

function RemoteCalibrationValues({ role, remote, step }: { role: DisplayRole; remote?: RemoteCalibration; step: number }) {
  const [value, setValue] = useState(remote?.value ?? DISPLAY_DEFAULTS[role]);
  const current = useRef(value);
  const edit = useRef(0);
  useEffect(() => {
    if (!remote?.connected) { edit.current = 0; return; }
    // Ignore older bridge snapshots while newer drag deltas are on their way.
    if (remote?.value && remote.edit >= edit.current) {
      current.current = remote.value;
      // eslint-disable-next-line react/react-compiler -- The paired iPad is the source of confirmed values.
      setValue(remote.value);
    }
  }, [remote]);
  const update: CalibrationUpdate = next => {
    if (!remote?.connected) return;
    const value = normalizeCalibration(typeof next === 'function' ? next(current.current) : next);
    current.current = value;
    setValue(value);
    edit.current = setRemoteCalibration(role, value);
  };
  const waiting = remote?.pending || value.x !== remote?.value?.x || value.y !== remote?.value?.y || value.scale !== remote?.value?.scale;
  const status = remote?.conflict ? 'Dva iPady mají stejnou roli. Oprav jejich role v nabídce iPady.'
    : !remote?.connected ? 'Displej není připojený. Propoj jej přes Bluetooth a aktualizuj aplikaci na obou iPadech.'
    : waiting ? 'Přenáším změnu — čekám na potvrzení displeje…'
    : remote.saved ? 'Potvrzeno a uloženo na bočním iPadu.'
    : 'Změna se zobrazila, ale na bočním iPadu ji nelze uložit.';
  return <>
    <output className="calibration-save" aria-live="polite">{status}</output>
    {remote?.connected && <CalibrationValues key="connected" role={role} calibration={value} update={update} step={step} />}
  </>;
}

export function CalibrationPanel({ display: role, sync, calibration, update, saved, children, indicator }: {
  display: CalibrationRole;
  sync?: TraySync;
  calibration: DisplayCalibration;
  update: CalibrationUpdate;
  saved: boolean;
  children?: ReactNode;
  indicator?: ReturnType<typeof useDisplayCalibration>;
}) {
  const nativeSync = useSyncExternalStore(subscribeSync, syncSnapshot, () => undefined);
  const [target, setTarget] = useState<CalibrationRole>(role);
  const canControlTray = role === 'center' && nativeSync?.role === 'host' && !nativeSync.preview;
  const selected = canControlTray ? target : role;
  const [element, setElement] = useState<'simulation' | 'indicator'>('simulation');
  const editingIndicator = selected === 'center' && element === 'indicator' && !!indicator;
  const localRole = editingIndicator ? 'indicator' : role;
  const local = editingIndicator ? indicator : { calibration, update, saved };
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [dock, setDock] = useState(role === 'left' ? 'right' : 'left');
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const closeButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const visibleTrigger = !isNativeHost() || role === 'center';
  useEffect(() => {
    const show = () => setOpen(true);
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    resize();
    window.addEventListener('michas:calibrate', show);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('michas:calibrate', show);
      window.removeEventListener('resize', resize);
    };
  }, []);
  useEffect(() => { if (open) closeButton.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [open]);

  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <>
    <button ref={trigger} className="display-calibration-trigger" data-operator-ui data-visible={visibleTrigger} data-display={role} aria-label={visibleTrigger ? 'Pozice a velikost' : 'Kalibrace bočního displeje'} aria-expanded={open} aria-controls="display-calibration" onClick={() => setOpen(value => !value)}>{visibleTrigger && 'Pozice a velikost'}</button>
    {open && <section id="display-calibration" className="display-calibration" data-operator-ui data-dock={dock} aria-label="Kalibrace displeje">
      <header><h1>{selected === 'center' ? 'Prostřední' : selected === 'left' ? 'Levý' : 'Pravý'} displej</h1><button ref={closeButton} onClick={close}>Skrýt</button></header>
      {canControlTray && <fieldset className="calibration-targets" aria-label="Ovládaný displej">
        {(['left', 'center', 'right'] as const).map(display => <button key={display} aria-pressed={selected === display} onClick={() => setTarget(display)}>
          {display === 'left' ? 'Levý' : display === 'center' ? 'Střed' : 'Pravý'}
        </button>)}
      </fieldset>}
      {selected === 'center' && indicator && <fieldset className="calibration-targets" aria-label="Upravovaný prvek">
        <button aria-pressed={!editingIndicator} onClick={() => setElement('simulation')}>Simulace</button>
        <button aria-pressed={editingIndicator} onClick={() => setElement('indicator')}>Stavový kruh</button>
      </fieldset>}
      {children}
      <p>{editingIndicator ? 'Stavový kruh · 100 % ≈ 2 cm' : selected === 'center' ? 'Simulace včetně okraje' : 'Celá grafika'} · posun od středu displeje</p>
      <div className="calibration-options">
        <label>Krok <select value={step} onChange={event => setStep(Number(event.target.value))}><option value={1}>1 px / 0,1 %</option><option value={10}>10 px / 1 %</option><option value={50}>50 px / 5 %</option></select></label>
        <label>Panel <select value={dock} onChange={event => setDock(event.target.value)}><option value="left">Vlevo</option><option value="right">Vpravo</option></select></label>
      </div>
      <p id="calibration-gestures" className="calibration-hint">Podrž +/− pro opakování. Po popisku X, Y nebo Velikost táhni do stran.</p>
      {selected === role ? <>
        <CalibrationValues key={localRole} role={localRole} calibration={local.calibration} update={local.update} step={step} />
        <output className="calibration-save">{local.saved ? 'Uloženo na tomto iPadu automaticky.' : 'Uložení není dostupné. Opište hodnoty před zavřením aplikace.'}</output>
        <label className="calibration-export">Hodnoty pro nastavení výchozího rozložení
          <textarea readOnly rows={10} value={JSON.stringify({ role: localRole, ...local.calibration, viewport }, null, 2)} onFocus={event => event.currentTarget.select()} />
        </label>
      </> : <RemoteCalibrationValues key={selected} role={selected as DisplayRole} remote={nativeSync?.displays?.[selected as DisplayRole]} step={step} />}
      {sync && <p className="calibration-status">{sync.preview ? 'Vizuální test bez propojení' : sync.message || 'Bez připojeného prostředního iPadu'}</p>}
    </section>}
  </>;
}
