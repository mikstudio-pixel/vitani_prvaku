import { createRoot } from 'react-dom/client';
import { Gallery } from './gallery';
import { DeviceLogin } from './device-login';
import '@/app/globals.css';
createRoot(document.getElementById('root')!).render(location.pathname.includes('/pripojeni/') ? <DeviceLogin /> : <Gallery />);
