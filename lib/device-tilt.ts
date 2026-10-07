import { clampTilt, type Tilt } from './tilt';
import { isNativeHost, isNativePaused, nativeCommand, type NativeMotion } from './native-host';

const RAD = Math.PI / 180;
const DEAD_ZONE = Math.sin(0.35 * RAD);
const FULL_TILT = Math.sin(18 * RAD);
const CORRECTION_KEY = 'vitani-prvaku.sensor-axis-correction.v1';

export type SensorState = {
  phase: 'off' | 'requesting' | 'waiting' | 'active' | 'paused' | 'error';
  message: string;
  correction: number;
};

export const SENSORS_OFF: SensorState = {
  phase: 'off', message: 'Zapni pohyb. Výchozí rovina je vodorovná.', correction: 0,
};

export type SensorDiagnostics = {
  beta: number | null;
  gamma: number | null;
  windowAngle: number | null;
  screenAngle: number | null;
  screenType: string;
  appliedAngle: number;
  neutral: Tilt;
};

// Downward gravity projected onto the device's fixed x/right and y/top axes.
// The Z-X-Y orientation convention avoids angle wrapping and ignores compass yaw.
export function orientationGravity(beta: number | null, gamma: number | null): Tilt | null {
  if (beta === null || gamma === null || !Number.isFinite(beta) || !Number.isFinite(gamma)) return null;
  return { x: Math.cos(beta * RAD) * Math.sin(gamma * RAD), y: -Math.sin(beta * RAD) };
}

export function screenTilt(gravity: Tilt, neutral: Tilt, screenAngle: number): Tilt {
  const angle = screenAngle * RAD;
  const dx = gravity.x - neutral.x, dy = gravity.y - neutral.y;
  const x = dx * Math.cos(angle) - dy * Math.sin(angle);
  const y = -dx * Math.sin(angle) - dy * Math.cos(angle);
  const length = Math.hypot(x, y);
  const scale = length > DEAD_ZONE ? (length - DEAD_ZONE) / (length * (FULL_TILT - DEAD_ZONE)) : 0;
  return clampTilt({ x: x * scale, y: y * scale });
}

type OrientationAPI = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export class DeviceTilt {
  private generation = 0;
  private timeout = 0;
  private sample: { gravity: Tilt; beta: number | null; gamma: number | null; angle?: number } | null = null;
  // Gravity has no component along a level screen, regardless of startup pose.
  private neutral: Tilt = { x: 0, y: 0 };
  private phase: SensorState['phase'] = 'off';
  private correction = 0;
  private diagnostics: SensorDiagnostics | null = null;

  constructor(private onTilt: (value: Tilt) => void, private onState: (state: SensorState) => void) {
    try {
      const saved = Number(window.localStorage.getItem(CORRECTION_KEY));
      if ([0, 90, 180, 270].includes(saved)) this.correction = saved;
    } catch { /* Motion still works when local storage is unavailable. */ }
  }

  private state(phase: SensorState['phase'], message: string) {
    this.phase = phase;
    this.onState({ phase, message, correction: this.correction });
  }

  // Call directly from a tap: Safari requires a user gesture for this permission.
  async start() {
    this.dispose();
    const generation = this.generation;
    this.onTilt({ x: 0, y: 0 });
    if (isNativeHost()) {
      window.addEventListener('michas:motion', this.receiveNative);
      window.addEventListener('michas:motion-error', this.nativeError);
      window.addEventListener('michas:power', this.visibility);
      document.addEventListener('visibilitychange', this.visibility);
      this.visibility();
      nativeCommand('tilt', true);
      return;
    }
    if (!window.isSecureContext) {
      this.fail('Pro pohyb otevři zabezpečenou HTTPS adresu aplikace.'); return;
    }
    const api = window.DeviceOrientationEvent as OrientationAPI | undefined;
    if (!api) { this.fail('Tento prohlížeč neposkytuje senzory. Zkus Safari na iPadu.'); return; }
    this.state('requesting', 'Povol aplikaci přístup k pohybu a orientaci.');
    try {
      const permission = api.requestPermission ? await api.requestPermission() : 'granted';
      if (generation !== this.generation) return;
      if (permission !== 'granted') {
        this.fail('Přístup k pohybu byl zamítnut. Povol ho pro tuto stránku v Safari a zkus to znovu.'); return;
      }
      window.addEventListener('deviceorientation', this.receive);
      document.addEventListener('visibilitychange', this.visibility);
      if (document.hidden) this.state('paused', 'Pohyb je pozastavený, dokud není aplikace vidět.');
      else this.waitForSample();
    } catch {
      if (generation === this.generation) this.fail('Pohyb se nepodařilo zapnout. Otevři aplikaci přímo v Safari a zkus to znovu.');
    }
  }

  private waitForSample() {
    window.clearTimeout(this.timeout);
    this.state('waiting', 'Čekám na senzory. Výchozí rovina je vodorovná.');
    this.timeout = window.setTimeout(() => {
      this.fail(isNativeHost()
        ? 'Senzory neposílají data. Zkus znovu zapnout pohyb; dotykové ovládání zůstává dostupné.'
        : 'Senzory neposílají data. Zkus iPadem lehce naklonit nebo znovu povolit pohyb v Safari.');
    }, 8000);
  }

  private receive = (event: DeviceOrientationEvent) => {
    if (document.hidden) return;
    const gravity = orientationGravity(event.beta, event.gamma);
    if (!gravity) return;
    this.sample = { gravity, beta: event.beta!, gamma: event.gamma! };
    window.clearTimeout(this.timeout);
    if (this.phase !== 'active') this.state('active', 'Pohyb je zapnutý. Nakláněj tác; dvojím klepnutím na mísu nastavíš novou rovinu.');
    this.publishTilt();
  };

  private receiveNative = (event: Event) => {
    if (document.hidden || isNativePaused()) return;
    const value = (event as CustomEvent<NativeMotion>).detail;
    if (!value || ![value.x, value.y, value.angle].every(Number.isFinite)) return;
    this.sample = { gravity: { x: value.x, y: value.y }, beta: null, gamma: null, angle: value.angle };
    window.clearTimeout(this.timeout);
    if (this.phase !== 'active') this.state('active', 'Pohyb je zapnutý. Nakláněj tác; dvojím klepnutím na mísu nastavíš novou rovinu.');
    this.publishTilt();
  };

  private nativeError = () => this.fail('Senzor iPadu není dostupný. Probuzení dotykem zůstává funkční. Zkontroluj oprávnění Pohyb a kondice v Nastavení.');

  private publishTilt() {
    if (!this.sample) return;
    // Keep the automatic mapping as a baseline. The saved correction handles
    // devices whose reported screen angle does not align with their motion axes.
    // eslint-disable-next-line typescript/no-deprecated -- Needed to align Safari motion axes with the displayed app.
    const legacyAngle = window.orientation;
    const screenAngle = window.screen.orientation?.angle;
    const angle = this.sample.angle ?? (Number.isFinite(legacyAngle) ? legacyAngle : Number.isFinite(screenAngle) ? screenAngle! : 0);
    const appliedAngle = (angle + this.correction + 360) % 360;
    this.diagnostics = {
      beta: this.sample.beta, gamma: this.sample.gamma,
      windowAngle: Number.isFinite(legacyAngle) ? legacyAngle : null,
      screenAngle: Number.isFinite(screenAngle) ? screenAngle! : null,
      screenType: isNativeHost() ? 'nativní iPad' : window.screen.orientation?.type || 'nedostupný',
      appliedAngle, neutral: this.neutral,
    };
    this.onTilt(screenTilt(this.sample.gravity, this.neutral, appliedAngle));
  }

  getDiagnostics() { return this.diagnostics; }

  rotateAxes() {
    if (this.phase !== 'active') return;
    this.correction = (this.correction + 90) % 360;
    let saved = true;
    try { window.localStorage.setItem(CORRECTION_KEY, String(this.correction)); }
    catch { saved = false; }
    this.publishTilt();
    this.state('active', `Korekce směru ${this.correction}°. ${saved ? 'Uloženo pro toto zařízení.' : 'Platí jen do zavření aplikace; uložení není dostupné.'}`);
  }

  calibrate() {
    if (!this.sample || this.phase !== 'active') return;
    this.neutral = this.sample.gravity;
    this.publishTilt();
    this.state('active', 'Klidová poloha nastavena. Nakláněj tác.');
  }

  private visibility = () => {
    this.onTilt({ x: 0, y: 0 });
    window.clearTimeout(this.timeout);
    if (document.hidden || isNativePaused()) this.state('paused', 'Pohyb je pozastavený, dokud není aplikace vidět.');
    else this.waitForSample();
  };

  private fail(message: string) {
    this.dispose();
    this.onTilt({ x: 0, y: 0 });
    this.state('error', message);
  }

  stop() {
    this.dispose();
    this.onTilt({ x: 0, y: 0 });
    this.state('off', SENSORS_OFF.message);
  }

  dispose() {
    this.generation++;
    window.clearTimeout(this.timeout);
    window.removeEventListener('deviceorientation', this.receive);
    window.removeEventListener('michas:motion', this.receiveNative);
    window.removeEventListener('michas:motion-error', this.nativeError);
    window.removeEventListener('michas:power', this.visibility);
    if (isNativeHost()) nativeCommand('tilt', false);
    document.removeEventListener('visibilitychange', this.visibility);
    this.sample = null; this.neutral = { x: 0, y: 0 }; this.diagnostics = null; this.phase = 'off';
  }
}
