import { useEffect, useState, type FormEvent } from 'react';
import { deviceAccess, portraitBackend, type DeviceAccess } from '@/lib/portrait-backend';
import { APP_VERSION } from '@/lib/app-version';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export function DeviceLogin() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  const [access, setAccess] = useState<DeviceAccess | null>(null);
  useEffect(() => { void deviceAccess().then(setAccess).catch(error => setStatus(error.message)); }, []);
  const login = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setStatus('');
    try {
      const { error } = await portraitBackend.auth.signInWithPassword({ email, password }); setPassword('');
      if (error) throw new Error('Přihlášení se nepodařilo. Ověř e-mail a heslo.');
      setAccess(await deviceAccess());
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Přihlášení se nepodařilo.'); }
    finally { setBusy(false); }
  };
  return <main className="device-login"><section>
    <h1>Připojení zařízení</h1>
    <p>Na iPadu přihlas účet pro fotografování. Na druhém počítači účet pro galerii.</p>
    {access ? <><p>{access.canUpload ? 'Fotografování a ukládání povoleno.' : 'Prohlížení galerie povoleno.'}</p>
      <a className="login-action" href={access.canUpload ? `${base}/` : `${base}/galerie/`}>{access.canUpload ? 'Otevřít misku' : 'Otevřít galerii'}</a>
      <button onClick={async () => { await portraitBackend.auth.signOut(); setAccess(null); }}>Odhlásit zařízení</button></> :
      <form onSubmit={login}><label>E-mail<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label>Heslo<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
      <button className="login-action" disabled={busy}>{busy ? 'Přihlašuji…' : 'Přihlásit'}</button></form>}
    {status && <p role="status">{status}</p>}
    <p className="login-note">Ukládá se jen zpracovaný černobílý portrét. Přihlášení platí pro tento prohlížeč.</p>
    <small>v {APP_VERSION.slice(0, 7)}</small>
  </section></main>;
}
