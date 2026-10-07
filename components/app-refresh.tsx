'use client';

import { useEffect, useState } from 'react';
import { APP_VERSION } from '@/lib/app-version';

export function AppRefresh() {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let checking = false;
    const check = async () => {
      if (document.visibilityState !== 'visible' || checking) return;
      checking = true;
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/version.json?t=${Date.now()}`, {
          cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) return;
        const release: unknown = await response.json();
        if (!controller.signal.aborted && release && typeof release === 'object' && 'version' in release && typeof release.version === 'string') {
          setHasUpdate(release.version !== APP_VERSION);
        }
      } catch {
        // The manual refresh remains available when the update check is offline.
      } finally {
        checking = false;
      }
    };
    void check();
    window.addEventListener('pageshow', check);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      controller.abort();
      window.removeEventListener('pageshow', check);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return (
    <button
      type="button" className="app-refresh" data-operator-ui data-update={hasUpdate}
      title={`Načíst aktuální aplikaci. Verze ${APP_VERSION}. Obnovení restartuje simulaci.`}
      onClick={() => {
        const url = new URL(window.location.href);
        url.searchParams.set('v', Date.now().toString());
        window.location.replace(url.href);
      }}
    >
      {hasUpdate ? 'Nová verze · obnovit' : 'Obnovit'}
      <span>{APP_VERSION === 'development' ? 'vývoj' : APP_VERSION.slice(0, 7)}</span>
    </button>
  );
}
