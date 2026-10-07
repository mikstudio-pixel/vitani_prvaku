import { createRoot } from 'react-dom/client';
import { InstallationApp } from './installation-app';
import '@/app/globals.css';
import { bindPresentationMode } from '@/lib/presentation-mode';

bindPresentationMode();
createRoot(document.getElementById('root')!).render(<InstallationApp />);
