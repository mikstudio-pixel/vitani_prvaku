'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { FluidBowl } from '@/lib/fluid';
import { asciiBowl } from '@/lib/ascii';

export function AsciiBowl({ engine }: { engine: RefObject<FluidBowl | null> }) {
  const text = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || !text.current) return;
      const motion = engine.current?.getMotion();
      text.current.textContent = asciiBowl(motion?.offset ?? { x: 0, y: 0 }, motion?.oil ?? 0);
    }, 90);
    return () => window.clearInterval(timer);
  }, [engine]);
  return (
    <figure className="ascii-study" aria-label="Miniatura vířící kaše složená výhradně ze znaků písma JetBrains Mono. Reaguje na stejné ovládání náklonu.">
      <figcaption className="ascii-caption"><span>03 / MONO STUDIE</span><span>JETBRAINS MONO</span></figcaption>
      <pre ref={text} className="ascii-bowl" aria-hidden="true">{asciiBowl({ x: 0, y: 0 }, 0)}</pre>
    </figure>
  );
}
