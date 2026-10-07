import { useCallback, useEffect, useRef, useState } from 'react';
import { deviceAccess, portraitBackend, portraitPng, publishPortrait, type DeviceAccess } from '@/lib/portrait-backend';

type Job = { id: string; blob: Blob; userId: string };
export function usePortraitArchive() {
  const access = useRef<DeviceAccess | null>(null), queue = useRef<Job[]>([]), busy = useRef(false), generation = useRef(0);
  const [status, setStatus] = useState('Galerie nepřipojena');
  const drain = useCallback(async () => {
    if (busy.current || !queue.current.length) return;
    busy.current = true; const revision = generation.current;
    try {
      while (queue.current.length && revision === generation.current) {
        const job = queue.current[0]; setStatus('Odesílám portrét…');
        await publishPortrait(job.id, job.blob, job.userId);
        if (revision !== generation.current) return;
        queue.current.shift();
      }
      if (revision === generation.current) setStatus('Portrét uložen');
    } catch { if (revision === generation.current) setStatus(`Neodesláno (${queue.current.length}) · zkusit znovu`); }
    finally { busy.current = false; if (revision !== generation.current && queue.current.length) void drain(); }
  }, []);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const revision = ++generation.current; access.current = null; queue.current = [];
      try {
        const value = await deviceAccess();
        if (!active || revision !== generation.current) return;
        access.current = value;
        setStatus(value?.canUpload ? 'Galerie připojena' : value ? 'Účet pouze pro galerii' : 'Galerie nepřipojena');
      } catch (error) { if (active && revision === generation.current) setStatus(error instanceof Error ? error.message : 'Galerii nelze připojit'); }
    };
    void refresh();
    const { data: { subscription } } = portraitBackend.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && session?.user.id !== access.current?.userId)) void refresh();
    });
    const retry = () => { void drain(); };
    window.addEventListener('online', retry);
    return () => { active = false; ++generation.current; queue.current = []; access.current = null; subscription.unsubscribe(); window.removeEventListener('online', retry); };
  }, [drain]);
  const save = useCallback(async (image: ImageData, size: number) => {
    const device = access.current, revision = generation.current;
    if (!device?.canUpload) return;
    if (queue.current.length >= 5) { setStatus('Fronta plná · zkusit znovu'); return; }
    try {
      const blob = await portraitPng(image, size);
      if (revision !== generation.current) return;
      queue.current.push({ id: crypto.randomUUID(), blob, userId: device.userId });
      void drain();
    } catch { setStatus('Portrét nelze uložit'); }
  }, [drain]);
  return { save, status, retry: drain };
}
