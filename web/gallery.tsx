import { useEffect, useRef, useState } from 'react';
import { deviceAccess, portraitBackend, type PortraitRow } from '@/lib/portrait-backend';
import { APP_VERSION } from '@/lib/app-version';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
function Portrait({ row }: { row: PortraitRow }) {
  const [url, setUrl] = useState(''), [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true, objectUrl = ''; setFailed(false);
    void portraitBackend.storage.from('portraits').download(row.object_path).then(({ data, error }) => {
      if (!active) return;
      if (error || !data) { setFailed(true); return; }
      objectUrl = URL.createObjectURL(data); setUrl(objectUrl);
    });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [row.object_path, attempt]);
  return <figure className="gallery-portrait">{url ? <img src={url} alt="Portrét návštěvníka" /> : failed ?
    <button onClick={() => setAttempt(value => value + 1)}>Načíst znovu</button> : <span aria-label="Načítám portrét" />}</figure>;
}
export function Gallery() {
  const [rows, setRows] = useState<PortraitRow[]>([]), [status, setStatus] = useState('Připojuji galerii…'), [authorized, setAuthorized] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true, channel: ReturnType<typeof portraitBackend.channel> | null = null, timer: ReturnType<typeof setInterval> | null = null;
    let loading = false, again = false;
    const merge = (incoming: PortraitRow[]) => {
      if (!active) return;
      setRows(previous => [...new Map([...previous, ...incoming].map(row => [row.id, row])).values()]
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)));
    };
    const reconcile = async () => {
      if (loading) { again = true; return; }
      loading = true;
      try {
        for (let start = 0; active; start += 1000) {
          const { data, error } = await portraitBackend.from('portraits').select('id,created_at,object_path').order('created_at').order('id').range(start, start + 999);
          if (error) throw error;
          merge(data || []);
          if (!data || data.length < 1000) break;
        }
        if (active) setStatus('');
      } catch { if (active) setStatus('Spojení přerušeno · obnovuji…'); }
      finally { loading = false; if (active && again) { again = false; void reconcile(); } }
    };
    void deviceAccess().then(access => {
      if (!active) return;
      if (!access) { setStatus('Přihlas tento počítač pro galerii.'); return; }
      setAuthorized(true);
      channel = portraitBackend.channel('vitani-prvaku-gallery').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portraits' }, payload => merge([payload.new as PortraitRow])).subscribe(state => {
        if (state === 'SUBSCRIBED') void reconcile();
        else if (active && (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT')) setStatus('Spojení přerušeno · obnovuji…');
      });
      // Initial load works even if WebSocket is unavailable; polling also catches reconnect gaps.
      void reconcile(); timer = setInterval(() => { void reconcile(); }, 30000);
    }).catch(error => { if (active) setStatus(error instanceof Error ? error.message : 'Galerii nelze připojit.'); });
    const subscription = portraitBackend.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') { active = false; setStatus('Přihlas tento počítač pro galerii.'); setAuthorized(false); setRows([]); if (channel) void portraitBackend.removeChannel(channel); if (timer) clearInterval(timer); } });
    return () => { active = false; subscription.data.subscription.unsubscribe(); if (timer) clearInterval(timer); if (channel) void portraitBackend.removeChannel(channel); };
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [rows.length]);
  return <main className="portrait-gallery" data-version={APP_VERSION}>
    <div className="gallery-grid">{rows.map(row => <Portrait key={row.id} row={row} />)}</div><div ref={end} />
    {!rows.length && <div className="gallery-empty"><p>{status || 'Čekám na první portrét…'}</p>{!authorized && <a href={`${base}/pripojeni/`}>Připojit zařízení</a>}</div>}
    {rows.length > 0 && status && <output className="gallery-status">{status}</output>}
    <a className="gallery-version" href={`${base}/pripojeni/`} title="Připojení zařízení">v {APP_VERSION.slice(0, 7)}</a>
  </main>;
}
