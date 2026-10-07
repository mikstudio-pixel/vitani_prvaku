import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import { deletePortrait, deviceAccess, portraitBackend, type PortraitRow } from '@/lib/portrait-backend';
import { APP_VERSION } from '@/lib/app-version';
import { galleryLayout } from '@/lib/gallery-layout';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
function Portrait({ row, canDelete, onDeleted, style }: { row: PortraitRow; canDelete: boolean; onDeleted: (id: string) => void; style: CSSProperties }) {
  const [url, setUrl] = useState(''), [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [deleting, setDeleting] = useState(false), [deleteError, setDeleteError] = useState('');
  useEffect(() => {
    let active = true, objectUrl = ''; setFailed(false);
    void portraitBackend.storage.from('portraits').download(row.object_path).then(({ data, error }) => {
      if (!active) return;
      if (error || !data) { setFailed(true); return; }
      objectUrl = URL.createObjectURL(data); setUrl(objectUrl);
    });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [row.object_path, attempt]);
  const remove = async () => {
    if (!window.confirm('Trvale smazat tento portrét?')) return;
    setDeleting(true); setDeleteError('');
    try { await deletePortrait(row); onDeleted(row.id); }
    catch { setDeleteError('Smazání selhalo. Zkus to znovu.'); }
    finally { setDeleting(false); }
  };
  return <figure className="gallery-portrait" style={style}>{url ? <img src={url} alt="Portrét návštěvníka" /> : failed ?
    <button className="gallery-retry" onClick={() => setAttempt(value => value + 1)}>Načíst znovu</button> : <span aria-label="Načítám portrét" />}
    {canDelete && <button className="gallery-delete" aria-label="Smazat portrét" title={deleteError || 'Smazat portrét'} disabled={deleting} onClick={() => { void remove(); }}>
      {deleting ? <LoaderCircle size={16} className="gallery-spinner" /> : <X size={16} />}
    </button>}
    {deleteError && <output className="gallery-delete-error" role="alert">{deleteError}</output>}
  </figure>;
}
export function Gallery() {
  const [rows, setRows] = useState<PortraitRow[]>([]), [status, setStatus] = useState('Připojuji galerii…'), [authorized, setAuthorized] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const changes = useRef(0);
  const [bounds, setBounds] = useState({ width: 0, height: 0 }), [canDelete, setCanDelete] = useState(false);
  const layout = galleryLayout(rows.length, bounds.width, bounds.height);
  const onDeleted = useCallback((id: string) => {
    ++changes.current;
    setRows(previous => previous.filter(row => row.id !== id));
  }, []);
  useEffect(() => {
    const element = grid.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setBounds({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true, channel: ReturnType<typeof portraitBackend.channel> | null = null, timer: ReturnType<typeof setInterval> | null = null;
    let loading = false, again = false;
    const merge = (incoming: PortraitRow[]) => {
      if (!active) return;
      ++changes.current;
      setRows(previous => [...new Map([...previous, ...incoming].map(row => [row.id, row])).values()]
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)));
    };
    const reconcile = async () => {
      if (loading) { again = true; return; }
      loading = true;
      const revision = changes.current, incoming: PortraitRow[] = [];
      try {
        for (let start = 0; active; start += 1000) {
          const { data, error } = await portraitBackend.from('portraits').select('id,created_at,object_path').order('created_at').order('id').range(start, start + 999);
          if (error) throw error;
          incoming.push(...(data || []));
          if (!data || data.length < 1000) break;
        }
        if (active) {
          if (revision === changes.current) { setRows(incoming); setStatus(''); }
          else again = true;
        }
      } catch { if (active) setStatus('Spojení přerušeno · obnovuji…'); }
      finally { loading = false; if (active && again) { again = false; void reconcile(); } }
    };
    void deviceAccess().then(access => {
      if (!active) return;
      if (!access) { setStatus('Přihlas tento počítač pro galerii.'); return; }
      setAuthorized(true);
      setCanDelete(access.canUpload);
      channel = portraitBackend.channel('vitani-prvaku-gallery')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portraits' }, payload => merge([payload.new as PortraitRow]))
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'portraits' }, payload => { if (active) onDeleted(payload.old.id); })
        .subscribe(state => {
        if (state === 'SUBSCRIBED') void reconcile();
        else if (active && (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT')) setStatus('Spojení přerušeno · obnovuji…');
      });
      // Initial load works even if WebSocket is unavailable; polling also catches reconnect gaps.
      void reconcile(); timer = setInterval(() => { void reconcile(); }, 30000);
    }).catch(error => { if (active) setStatus(error instanceof Error ? error.message : 'Galerii nelze připojit.'); });
    const subscription = portraitBackend.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') { active = false; setStatus('Přihlas tento počítač pro galerii.'); setAuthorized(false); setRows([]); if (channel) void portraitBackend.removeChannel(channel); if (timer) clearInterval(timer); } });
    return () => { active = false; subscription.data.subscription.unsubscribe(); if (timer) clearInterval(timer); if (channel) void portraitBackend.removeChannel(channel); };
  }, [onDeleted]);
  return <main className="portrait-gallery" data-version={APP_VERSION}>
    <div ref={grid} className="gallery-grid" style={{ gridTemplateColumns: `repeat(${layout.columns * 2}, ${Math.max(0, (layout.size - layout.gap) / 2)}px)`, gridTemplateRows: `repeat(${layout.rows}, ${layout.size}px)`, gap: layout.gap }}>
      {rows.map((row, index) => <Portrait key={row.id} row={row} canDelete={canDelete} onDeleted={onDeleted} style={{ gridColumn: `${layout.positions[index].column} / span 2`, gridRow: layout.positions[index].row }} />)}
    </div>
    {!rows.length && <div className="gallery-empty"><p>{status || 'Čekám na první portrét…'}</p>{!authorized && <a href={`${base}/pripojeni/`}>Připojit zařízení</a>}</div>}
    {rows.length > 0 && status && <output className="gallery-status">{status}</output>}
    <a className="gallery-version" href={`${base}/pripojeni/`} title="Připojení zařízení">v {APP_VERSION.slice(0, 7)}</a>
  </main>;
}
