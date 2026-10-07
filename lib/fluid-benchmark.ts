import { FluidBowl, type FluidStats } from './fluid';

// A separate engine makes diagnostics reproducible without changing a user's bowl.
export async function runFluidBenchmark(root: HTMLElement, publish: (result: unknown) => void = () => {}) {
  const output = document.createElement('pre'), canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:600px;max-width:90vw;aspect-ratio:1';
  output.style.cssText = 'white-space:pre-wrap;color:white';
  root.replaceChildren(output, canvas);
  const results: unknown[] = [];
  const startedAt = new Date().toISOString();
  publish({ complete: false, startedAt, results });
  for (const [resolution, materialResolution] of [[192, 512], [160, 512], [160, 384]] as const) {
    output.textContent = `Měřím ${resolution} / ${materialResolution}…`;
    const fps: number[] = [];
    let collecting = false;
    const warmupSeconds = 3, sampleSeconds = materialResolution === 384 ? 60 : 12;
    const engine = new FluidBowl(canvas, {
      native: true, resolution, materialResolution, quality: 'detail',
      ambientFlow: true, automaticCrests: true,
      onStats: (stats: FluidStats) => { if (collecting) fps.push(stats.fps); },
      onTelemetry: () => {},
    });
    try {
      const timings = await engine.benchmark();
      engine.reset(); engine.setPaused(false);
      const start = performance.now();
      await new Promise<void>(resolve => {
        const move = (time: number) => {
          const seconds = (time - start) / 1000;
          engine.setTilt({ x: .88 * Math.cos(seconds * 3.1), y: .88 * Math.sin(seconds * 3.1) });
          collecting = seconds > warmupSeconds;
          if (seconds < warmupSeconds + sampleSeconds) requestAnimationFrame(move); else resolve();
        };
        requestAnimationFrame(move);
      });
      results.push({ ...timings, sampleSeconds, liveFps: fps });
      publish({ complete: false, startedAt, results });
    } finally { engine.dispose(); }
  }
  const report = { complete: true, startedAt, userAgent: navigator.userAgent, results };
  output.textContent = JSON.stringify(report, null, 2); publish(report);
  return report;
}
