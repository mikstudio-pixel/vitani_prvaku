import { createRoot } from 'react-dom/client';
import { InstallationApp } from './installation-app';
import '@/app/globals.css';

createRoot(document.getElementById('root')!).render(<InstallationApp />);
