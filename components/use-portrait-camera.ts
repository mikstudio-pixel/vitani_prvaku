import { useCallback, useEffect, useRef, useState } from 'react';
import { CAMERA_OFF, PortraitCamera } from '@/lib/portrait-camera';
import { PortraitHold } from '@/lib/portrait-hold';

export function usePortraitCamera(enabled: boolean, onCapture: (image: ImageData) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useRef<PortraitCamera | null>(null);
  const hold = useRef(new PortraitHold());
  const animation = useRef(0);
  const [state, setState] = useState(CAMERA_OFF);
  const [progress, setProgress] = useState(0);
  const [captureError, setCaptureError] = useState('');
  const cancel = useCallback(() => {
    hold.current.cancel(); cancelAnimationFrame(animation.current); setProgress(0);
  }, []);
  useEffect(() => {
    if (!videoRef.current) return;
    const device = new PortraitCamera(videoRef.current, setState); camera.current = device;
    const hidden = () => { if (document.hidden) { cancel(); device.stop(); } };
    const blur = () => cancel();
    const leave = () => { cancel(); device.stop(); };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('blur', blur);
    window.addEventListener('pagehide', leave);
    return () => {
      cancel(); device.stop(); camera.current = null;
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pagehide', leave);
    };
  }, [cancel]);
  useEffect(() => { if (!enabled || state.phase !== 'ready') cancel(); }, [enabled, state.phase, cancel]);
  const prepare = () => { setCaptureError(''); cancel(); void camera.current?.prepare(); };
  const down = (id: number, x = 0, y = 0) => {
    if (!enabled || state.phase !== 'ready') return;
    hold.current.down(id, performance.now(), x, y);
    setCaptureError(''); cancelAnimationFrame(animation.current);
    const tick = (now: number) => {
      const frame = hold.current.step(now); setProgress(frame.progress);
      if (frame.capture) {
        try { const image = camera.current?.capture(); if (image) onCapture(image); }
        catch (error) { setCaptureError(error instanceof Error ? error.message : 'Fotografii se nepodařilo pořídit.'); camera.current?.stop(); }
        cancel();
      } else if (hold.current.active) animation.current = requestAnimationFrame(tick);
    };
    animation.current = requestAnimationFrame(tick);
  };
  const up = (id: number) => { hold.current.up(id); if (!hold.current.active) { cancelAnimationFrame(animation.current); setProgress(0); } };
  const move = (id: number, x: number, y: number) => { hold.current.move(id, x, y); if (!hold.current.active) { cancelAnimationFrame(animation.current); setProgress(0); } };
  return { videoRef, state, progress, captureError, prepare, down, up, move, cancel, stop: () => { cancel(); camera.current?.stop(); } };
}
