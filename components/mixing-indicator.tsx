import { useLayoutEffect, useRef } from 'react';
import type { DisplayCalibration } from '@/lib/display-calibration';
import { mixingIndicatorColor, type MixingIndicatorFrame } from '@/lib/mixing-indicator';
import ready from '@/web/artwork/scenario/center/ready.svg';
import three from '@/web/artwork/scenario/center/3.svg';
import two from '@/web/artwork/scenario/center/2.svg';
import one from '@/web/artwork/scenario/center/1.svg';
import start from '@/web/artwork/scenario/center/start.svg';
import arrival from '@/web/artwork/scenario/center/arrival.svg?raw';
import './mixing-indicator.css';
import './startup-flicker.css';

const prompts = { ready, '3': three, '2': two, '1': one, start };
/** Match the central bowl captions and darkened material in the Figma flow. */
export function MixingPrompt({ frame }: { frame: MixingIndicatorFrame }) {
  if (!frame.prompt) return null;
  if (frame.prompt === 'detected') return <ArrivalCaption />;
  if (frame.prompt === 'done') return <span className="mixing-prompt" data-prompt="done"><span className="mixing-finish">DOMÍCHÁNO</span></span>;
  // Bundled vector artwork must also work offline in WKWebView.
  /* oxlint-disable-next-line next/no-img-element */
  return <span className="mixing-prompt" data-prompt={frame.prompt}><img src={prompts[frame.prompt]} width={620} height={620} alt={frame.prompt === 'ready' ? 'Jsi ready?' : frame.prompt === 'start' ? 'Míchej' : frame.prompt} draggable={false} /></span>;
}

function ArrivalCaption() {
  const root = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    // Keep telemetry renders from restoring the hidden, untyped SVG groups.
    root.current!.innerHTML = arrival;
    const glyphs = [...root.current!.querySelectorAll<SVGElement>('[data-arrival-glyph]')];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const started = performance.now();
    let animation = 0, sounded = 0;
    const tick = (now: number) => {
      const count = reduced ? glyphs.length : Math.min(glyphs.length, Math.floor((now - started) / 45));
      glyphs.forEach((glyph, index) => { glyph.style.visibility = index < count ? 'visible' : 'hidden'; });
      if (count > sounded && !reduced) window.dispatchEvent(new Event('vitani-prvaku:typing'));
      sounded = count;
      if (count < glyphs.length) animation = requestAnimationFrame(tick);
    };
    tick(started);
    return () => cancelAnimationFrame(animation);
  }, []);
  return <span className="mixing-prompt arrival-prompt" data-prompt="detected" aria-label="Mícháš nebo nemícháš?">
    <span aria-hidden="true" ref={root} />
  </span>;
}

export function MixingIndicatorDot({ frame, calibration, paused }: {
  frame: MixingIndicatorFrame; calibration: DisplayCalibration; paused: boolean;
}) {
  return <output className="mixing-indicator" hidden={paused || frame.phase !== 'success'} data-phase={frame.phase} aria-live="off"
    style={{ backgroundColor: mixingIndicatorColor(frame), transform: `translate(-50%, -50%) translate(${calibration.x}px, ${calibration.y}px) scale(${calibration.scale})` }}>
    <span className="sr-only">{frame.phase === 'success' ? 'Míchání dokončeno' : frame.phase === 'mixing' ? 'Probíhá míchání' : 'Připraveno k míchání'}</span>
  </output>;
}
