import { portraitPattern } from '@/lib/portrait-material';
import { useEffect, useMemo, useRef } from 'react';

function Frame({ image, label }: { image: ImageData | null; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = image?.width ?? 1; canvas.height = image?.height ?? 1;
    if (image) canvas.getContext('2d')?.putImageData(image, 0, 0);
  }, [image]);
  return <figure><canvas ref={ref} aria-label={label} /><figcaption>{label}</figcaption></figure>;
}
export function PortraitPreview({ captured, isolated, status, stretch, onStretch, resolution, onResolution }: {
  captured: ImageData | null; isolated: ImageData | null; status: string; stretch: boolean; onStretch: (enabled: boolean) => void; resolution: number; onResolution: (size: number) => void;
}) {
  const preview = useMemo(() => {
    if (!isolated) return null;
    const pattern = portraitPattern(isolated, resolution), data = new Uint8ClampedArray(resolution * resolution * 4);
    for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
      const i = (y * resolution + x) * 4, light = Math.round(255 * (1 - pattern[(resolution - 1 - y) * resolution + x]));
      data[i] = data[i + 1] = data[i + 2] = light; data[i + 3] = 255;
    }
    return new ImageData(data, resolution, resolution);
  }, [isolated, resolution]);
  return <aside className={`portrait-preview${captured ? '' : ' is-empty'}`} aria-label="Náhled a efekt fotografie">
    {captured && <><Frame image={captured} label="Vyfoceno" /><Frame image={preview} label={stretch ? 'Roztažený portrét' : 'Do kapaliny'} /></>}
    {status && <output>{status}</output>}
    <button type="button" role="switch" aria-checked={stretch} className="portrait-switch" onClick={() => onStretch(!stretch)}>
      Roztažení <span aria-hidden="true" className="switch-track" />
    </button>
    <label className="portrait-resolution">
      <span>Čtverečky <output>{resolution} × {resolution}</output></span>
      <input type="range" min="16" max="160" step="8" value={resolution} aria-label="Rozlišení fotografie" onChange={event => onResolution(Number(event.target.value))} />
      <span className="resolution-ends"><span>Méně</span><span>Více</span></span>
    </label>
  </aside>;
}
