/* oxlint-disable next/no-img-element -- Offline WKWebView has no Next image server. */
import { useEffect, useRef } from 'react';
import Home from '@/app/page';
import { DisplaySwitcher } from '@/components/display-switcher';
import { isNativeHost, type TraySync } from '@/lib/native-host';
import type { DisplayRole } from '@/lib/display-calibration';
import type { ScenarioStage } from '@/lib/mixing-scenario';
import { CalibrationPanel, useDisplayCalibration } from '@/components/display-calibration';
import { useSideScenario } from './use-side-scenario';
import { RightDisplay, SCREENS } from './right-display';
import { LeftDisplay } from './left-display';
import { INTRO, trackProgress } from '@/lib/intro-animation';
import './installation.css';
import { useColonyDirection } from '@/lib/colony-settings';
import { bindIntroSettings } from '@/lib/intro-settings';
import { InstallationAudio, bindInstallationAudio } from '@/lib/installation-audio';
import { visualMixingProgress } from '@/lib/mixing-scenario';

const fallback: TraySync = { role: 'standalone', code: '', message: '', peers: 0 };
const previewRole = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('display');
const browserPreview: TraySync = previewRole === 'left' || previewRole === 'right'
  ? { ...fallback, role: previewRole, preview: true } : fallback;

function SideDisplay({ role, sync }: { role: DisplayRole; sync: TraySync }) {
  useEffect(() => bindIntroSettings(), []);
  const settings = useDisplayCalibration(role);
  const motion = useSideScenario(sync);
  const audio = useRef<InstallationAudio | null>(null);
  useEffect(() => {
    const player = new InstallationAudio(role === 'left' ? 'left' : 'right');
    audio.current = player;
    const unbind = bindInstallationAudio(player);
    return () => { audio.current = null; unbind(); };
  }, [role]);
  useEffect(() => {
    audio.current?.update({ stage: motion.scenario.stage, elapsed: motion.scenarioElapsed,
      activity: motion.input.sample?.activity ?? 0, progress: visualMixingProgress(motion.scenario.progress),
      available: !motion.frozen && !!motion.input.sample && motion.intro.stage !== 'waiting'
        && motion.intro.stage !== 'orbit' && motion.scenario.stage !== 'detected'
        && !document.hidden });
  }, [motion]);
  const colony = useColonyDirection(role === 'left');
  const { x, y, scale } = settings.calibration;
  const monochrome = motion.intro.stage === 'complete' ? 0 : motion.intro.stage === 'panels' ? 1 - trackProgress(motion.intro.elapsed, INTRO.panels.color) : 1;
  const source = motion.demo !== 'live' ? 'Ukázka scénáře' : motion.input.source === 'bluetooth' ? 'Bluetooth · prostřední iPad' : motion.input.source === 'local' ? 'Vlastní gyroskop tohoto iPadu' : 'Čekám na pohybová data';
  return <main className="tray-display" aria-label={role === 'left' ? 'Levý displej · informace o misi' : 'Pravý displej · instrukce'}>
    {!isNativeHost() && <DisplaySwitcher current={role} sidePreview />}
    <div className="tray-artwork" data-wake-stage={motion.intro.stage} style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`, filter: role === 'left' ? `grayscale(${monochrome})` : undefined,
      visibility: !motion.frozen && (motion.intro.stage === 'waiting' || motion.intro.stage === 'orbit' || motion.scenario.stage === 'detected') ? 'hidden' : undefined }}>
      {role === 'left'
        ? <LeftDisplay intro={motion.intro} progress={motion.scenario.stage === 'standby' ? 0 : visualMixingProgress(motion.scenario.progress)} stage={motion.scenario.stage} colonyDirection={colony.direction} />
        : <RightDisplay scenario={motion.scenario} sample={motion.input.sample} monochrome={monochrome} source={motion.demo === 'live' ? motion.input.source : 'demo'} />}
    </div>
    <CalibrationPanel display={role} sync={sync} {...settings}>
      <section className="scenario-controls" aria-label="Pohyb a scénář">
        <output className="scenario-source">Zdroj dat: {source}</output>
        <p>Boční náhled. Celý průběh spustíš ukázkou; gyroskop zde ovládá pohyb, neměří zamíchání.</p>
        {motion.sensorError && motion.input.source === 'none' && <p>{motion.sensorError}</p>}
        {!isNativeHost() && <button onClick={motion.enableBrowserMotion}>Povolit gyroskop</button>}
        {role === 'left' && <label>Kolonie ADD · směr změn
          <select aria-label="Směr změn Kolonie ADD" value={colony.direction} onChange={event => colony.setDirection(event.target.value === 'improve' ? 'improve' : 'degrade')}>
            <option value="degrade">Zhoršování pojmů</option><option value="improve">Zlepšování pojmů</option>
          </select>
          {!colony.saved && <span>Nastavení se nepodařilo uložit.</span>}
        </label>}
        {role === 'right' && <>
          <label>Scénář <select aria-label="Fáze scénáře" value={motion.frozen ?? ''} onChange={event => motion.freeze(event.target.value ? event.target.value as ScenarioStage : null)}>
            <option value="">Automaticky podle pohybu</option>
            {(Object.entries(SCREENS) as [ScenarioStage, typeof SCREENS[ScenarioStage]][]).map(([stage, screen]) => <option key={stage} value={stage}>{screen.title}</option>)}
          </select></label>
        </>}
        <div className="scenario-demo-buttons"><button onClick={() => motion.start('mix')}>Ukázka: mícháš</button><button onClick={() => motion.start('still')}>Ukázka: nemícháš</button></div>
        <button onClick={() => motion.start('live')}>Znovu jen pohyb gyroskopu</button>
        <p>{motion.frozen ? 'Zastavený náhled pro kalibraci.' : SCREENS[motion.scenario.stage].title}</p>
      </section>
    </CalibrationPanel>
  </main>;
}

export function InstallationApp() {
  if (browserPreview.role === 'left' || browserPreview.role === 'right') {
    return <SideDisplay role={browserPreview.role} sync={browserPreview} />;
  }
  return <Home sidePreview />;
}
