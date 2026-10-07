/* oxlint-disable next/no-img-element -- SVG artwork is bundled for offline WKWebView. */
import { useLayoutEffect, useRef, useState } from 'react';
import { visualMixingProgress, type MotionSample, type ScenarioSnapshot, type ScenarioStage } from '@/lib/mixing-scenario';
import { TypewriterArtwork } from './typewriter-artwork';
import { SCREENS } from './scenario-screens';
export { SCREENS } from './scenario-screens';
import countdownStartMarkup from './artwork/scenario/countdown-start.svg?raw';
import { GyroscopeModel } from './gyroscope-model';

/** Keep only the outgoing progress frame, in its original Figma coordinates. */
function OutgoingProgressFrame() {
  const root = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const artwork = new DOMParser().parseFromString(SCREENS['keep-mixing'].markup, 'image/svg+xml').documentElement;
    const frame = artwork.querySelector('[id="Frame 2147207728_19"]');
    const defs = artwork.querySelector('defs');
    if (!frame || !root.current) return;
    // Prefix definitions so the incoming artwork can use its own IDs safely.
    const elements = [frame, ...(defs ? [defs] : [])];
    for (const element of elements) {
      for (const node of [element, ...element.querySelectorAll('*')]) {
        for (const attribute of Array.from(node.attributes)) {
          if (attribute.name === 'id') node.id = `phase-exit-${attribute.value}`;
          else if (attribute.value.includes('url(#')) node.setAttribute(attribute.name, attribute.value.replace(/url\(#/g, 'url(#phase-exit-'));
        }
      }
    }
    root.current.setAttribute('viewBox', artwork.getAttribute('viewBox')!);
    root.current.replaceChildren(...elements);
  }, []);
  return <svg ref={root} className="scenario-readings" aria-hidden="true" />;
}

const dataStages: ScenarioStage[] = ['panels', 'authorized', 'decision', 'countdown', 'analysis', 'mixing', 'keep-mixing', 'stir-prompt', 'not-mixing', 'finishing', 'success'];

/** Finish the live percentage and bar together on one animation clock. */
function MixingReadout({ value, complete }: { value: number | null; complete: boolean }) {
  const root = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const text = root.current!.querySelector('text')!;
    const bar = root.current!.querySelector('rect')!;
    const draw = (progress: number | null) => {
      text.textContent = progress === null ? '—' : `${Math.round(progress * 100)}%`;
      bar.setAttribute('width', String(progress === null ? 0 : Math.max(7, 299 * progress)));
      bar.dataset.mixingProgress = String(progress ?? 'unavailable');
    };
    if (!complete) { draw(value); return; }
    const from = value ?? 1;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || from >= 1) {
      draw(1); return;
    }
    const started = performance.now();
    let frame = 0;
    draw(from);
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - started) / 700));
      draw(from + (1 - from) * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [complete, value]);
  return <svg ref={root} className="scenario-readings" viewBox="0 0 744 1073" aria-label="Průběh míchání">
    <text className="scenario-percent" x="402" y="520.69" fontSize="74" />
    <svg x="402" y="548" width="299" height="40" viewBox="0 0 299 40" style={{ overflow: 'hidden', borderRadius: 2 }}>
      <rect width="0" height="40" fill="#1279ff" />
    </svg>
  </svg>;
}

export function RightDisplay({ scenario, sample, source = 'local', monochrome = 0 }: { scenario: ScenarioSnapshot; sample: MotionSample | null; source?: string; monochrome?: number }) {
  const { stage, progress } = scenario;
  const hasData = dataStages.includes(stage);
  const [lastData, setLastData] = useState({ scenario, sample });
  if (hasData && (lastData.scenario !== scenario || lastData.sample !== sample)) setLastData({ scenario, sample });
  const exiting = stage === 'bon-appetit' && lastData.scenario.stage === 'success';
  const readings = exiting ? lastData : { scenario, sample };
  const dataStage = readings.scenario.stage;
  const dataMixed = readings.scenario.mixed;
  const retrySeconds = Math.max(1, Math.ceil(scenario.remaining));
  const title = stage === 'hungry' ? `Na Digitál chceme jenom pořádné míchače. Počkej ${retrySeconds} sekund a zkus to znovu.` : SCREENS[stage].title;
  const gyro = readings.sample?.gyro && Object.values(readings.sample.gyro).every(Number.isFinite) ? readings.sample.gyro : null;
  const preparing = ['panels', 'authorized', 'decision', 'countdown'].includes(stage);
  const displayedProgress = visualMixingProgress(preparing ? 0 : exiting ? dataMixed : progress);
  const starting = stage === 'countdown' && scenario.countdown === 0;
  const markup = stage === 'success' ? SCREENS['keep-mixing'].markup : starting ? countdownStartMarkup : SCREENS[stage].markup;
  return <div className="right-display" data-stage={stage}>
    <span style={{ filter: `grayscale(${monochrome})` }}><TypewriterArtwork entry={stage === 'detected' ? 'detected' : ''} markup={markup} retrySeconds={stage === 'hungry' ? retrySeconds : null} flickerMessage={stage === 'connecting' || stage === 'welcome' || stage === 'restart'} /></span>
    <output className="sr-only">{title}</output>
    {stage === 'restart' && <svg className="scenario-readings" viewBox="0 0 744 1073" aria-label={`Konec session za ${retrySeconds} sekund`}>
      <text x="402" y="875" fontSize="18" fill="#BFBAB2">KONEC SESSION ZA {retrySeconds} s</text>
    </svg>}
    {(hasData || exiting) && <>
      <div className="scenario-data-layer" data-phase-exit={exiting ? 'progress' : undefined} style={{ filter: `grayscale(${monochrome})` }} aria-hidden={exiting || undefined}>
        {exiting && <OutgoingProgressFrame />}
        <MixingReadout value={displayedProgress} complete={dataStage === 'success'} />
      </div>
      <div className="scenario-data-layer" data-phase-exit={exiting ? 'gyroscope' : undefined} style={{ filter: `grayscale(${monochrome})` }} aria-hidden={exiting || undefined}>
        <GyroscopeModel gyro={gyro} light={readings.sample?.light ?? null} source={source} active />
        <svg className="scenario-readings" viewBox="0 0 744 1073" aria-label={exiting ? undefined : 'Gyroskop'}>
        {(['x', 'y', 'z'] as const).map((axis, i) => <text key={axis} x={399 + i * 8} y={852 + i * 21} fontSize="12">
          {axis.toUpperCase()}-AXIS
          <tspan x={450.43 + i * 8} opacity=".2">{'//'}</tspan>
          <tspan x={465.13 + i * 8} xmlSpace="preserve">{gyro ? `${gyro[axis] >= 0 ? ' ' : ''}${gyro[axis].toFixed(5)}°` : '—'}</tspan>
        </text>)}
        <text x="448" y="975.3" fontSize="10" fill="#ccc" opacity=".4">GYROSKOP</text>
        <text x="496.98" y="975.3" fontSize="10" fill="#ccc">{gyro ? '.ONLINE' : '.OFFLINE'}</text>
        </svg>
      </div>
    </>}
  </div>;
}
