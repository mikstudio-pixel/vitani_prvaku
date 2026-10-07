import type { CSSProperties, ReactNode } from 'react';
import type { FluidTelemetry } from '@/lib/fluid-telemetry';

const percent = (value: number) => `${Math.round(value * 100)} %`;
const number = (value: number) => value.toFixed(4).replace('.', ',');
const effectNames: Record<string, string> = { contours: 'Vrstevnice', height: 'Výška', grid: 'Mřížka', dots: 'Body', flow: 'Částice proudu' };

// Flow and height have no fixed maximum: brighten smoothly without a false peak.
const intensity = (value: number, scale: number) => 1 - Math.exp(-value / scale);
type ReadoutRow = [label: string, text: string | null, title: string, level: number | null, pulseAtMax?: boolean];

function ReadoutValue({ children, level, pulseAtMax = true }: { children: ReactNode; level: number | null; pulseAtMax?: boolean }) {
  const brightness = Math.pow(Math.max(0, Math.min(1, level ?? 0)), 0.7);
  return (
    <dd>
      <span>{children}</span>
      <span className="readout-led" aria-hidden="true" data-peak={pulseAtMax && level !== null && level >= 0.995}
        style={{ '--readout-level': brightness } as CSSProperties} />
    </dd>
  );
}

export function FluidReadout({ value }: { value: FluidTelemetry | null }) {
  const rows: ReadoutRow[] = [
    ['Promísení', value && percent(value.mixed), 'Sjednocení skutečné barvy: 0 % = oddělené barvy, 100 % = jednolitá směs. Měřeno z rozptylu koncentrace.', value && value.mixed],
    ['Paměť míchání', value && percent(value.exposure), 'Průměr místní rozpustitelnosti uložené v kapalině. Po zvolnění pozvolna klesá.', value && value.exposure],
    ['Paměť min–max', value && `${percent(value.exposureMin)} – ${percent(value.exposureMax)}`, 'Nejméně a nejvíce rozpustná část kapaliny. Dioda sleduje maximum.', value && value.exposureMax],
    ['Tmavá / světlá', value && `${percent(value.darkFraction)} / ${percent(1 - value.darkFraction)}`, 'Plošný poměr obou složek. Dioda sleduje podíl tmavé složky.', value && value.darkFraction, false],
    ['Síla míchání', value && percent(Math.abs(value.stirring) / 2), 'Síla pohonu cirkulace; skutečný doznívající proud je měřen zvlášť níže.', value && Math.abs(value.stirring) / 2],
    ['Obnova fází', value && percent(value.recovery), 'Síla obnovy nerozpustnosti, nikoli její dokončení. Drobné pohyby ji nezastavují.', value && value.recovery],
    ['Širší spojování', value && percent(value.grouping), 'Průměrná síla širšího spojování, včetně místního útlumu podle paměti. Nejde o míru dokončení.', value && value.grouping],
    ['Proud RMS', value && `${number(value.flowRms)} /s`, 'Skutečná rychlost proudu: kvadratický průměr, v šířkách výpočetního pole za sekundu. Jas je orientační, bez pevného maxima.', value && intensity(value.flowRms, 0.04), false],
    ['Proud max', value && `${number(value.flowMax)} /s`, 'Nejvyšší rychlost proudu ve výpočetním poli. Jas je orientační, bez pevného maxima.', value && intensity(value.flowMax, 0.12), false],
    ['Vlnění RMS', value && number(value.waveRms), 'Kvadratický průměr výšky hladiny v jednotkách modelu, nikoli v centimetrech. Jas je orientační, bez pevného maxima.', value && intensity(value.waveRms, 0.04), false],
  ];
  return (
    <section className="fluid-readout" aria-label="Živé parametry kapaliny" aria-live="off">
      <header><span>KAPALINA</span><span className="readout-live">{value ? 'LIVE · 5 Hz' : 'MĚŘÍM…'}</span></header>
      <dl>{rows.map(([label, text, title, level, pulseAtMax]) => <div key={label} title={title}><dt>{label}</dt><ReadoutValue level={level} pulseAtMax={pulseAtMax}>{text ?? '—'}</ReadoutValue></div>)}</dl>
      <h2>EFEKTY</h2>
      <dl>
        <div><dt>Hřebeny</dt><ReadoutValue level={value && value.crests}>{value ? value.crestsMode === 'off' ? 'VYP' : `${value.crestsMode === 'auto' ? 'AUTO' : 'ZAP'} · ${percent(value.crests)}` : '—'}</ReadoutValue></div>
        <div title="Dostupná síla jemného náhodného proudění. Jednotlivé víry se dál pozvolna mění."><dt>Jemné víry</dt><ReadoutValue level={value && value.drift}>{value ? value.driftEnabled ? `ZAP · ${percent(value.drift)}` : 'VYP' : '—'}</ReadoutValue></div>
        <div><dt>Tvarová protiváha</dt><ReadoutValue level={value && Number(value.organicEnabled)} pulseAtMax={false}>{value ? value.organicEnabled ? 'ZAP' : 'VYP' : '—'}</ReadoutValue></div>
        <div><dt>Rozpouštění</dt><ReadoutValue level={value && Number(value.dissolvingEnabled)} pulseAtMax={false}>{value ? value.dissolvingEnabled ? 'ZAP' : 'VYP' : '—'}</ReadoutValue></div>
        {value?.effects.map(effect => <div key={effect}><dt>{effectNames[effect] ?? effect}</dt><ReadoutValue level={1} pulseAtMax={false}>ZAP</ReadoutValue></div>)}
      </dl>
      <p className="readout-note">Proud a vlnění: jednotky modelu. RMS = průměrná intenzita.</p>
    </section>
  );
}
