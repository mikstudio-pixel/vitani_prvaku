import { createRoot } from 'react-dom/client';
import { InstallationApp } from './installation-app';
import '@/app/globals.css';
import { bindPresentationMode } from '@/lib/presentation-mode';
import { runFluidBenchmark } from '@/lib/fluid-benchmark';

bindPresentationMode();
const root = document.getElementById('root')!;
if (window.__michasNative?.benchmark) {
  const publish = (result: unknown) => window.webkit?.messageHandlers?.michas?.postMessage({ command: 'benchmark-result', result });
  void runFluidBenchmark(root, publish).catch(error => {
    root.textContent = String(error); publish({ complete: false, error: String(error) });
  });
} else createRoot(root).render(<InstallationApp />);
