import { useEffect, useRef } from 'react';

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
export function PortraitPreview({ captured, isolated, status }: { captured: ImageData | null; isolated: ImageData | null; status: string }) {
  if (!captured) return null;
  return <aside className="portrait-preview" aria-label="Náhled poslední fotografie">
    <Frame image={captured} label="Vyfoceno" /><Frame image={isolated} label="Bez pozadí" />
    {status && <output>{status}</output>}
  </aside>;
}
