import { isNativeHost, isNativePaused, nativeCommand, reportAudio } from './native-host';
import { mixingSound, SoundSequence, type SoundCue, type SoundFrame, type SoundRole } from './sound-design';
import { SOUND_ASSETS } from '../web/sounds/assets';
import { bindSoundSettings, DEFAULT_SOUND_SETTINGS, type SoundSettings } from './sound-settings';
import { MIXING_FINALE } from './mixing-scenario';

type Voice = { source: AudioBufferSourceNode; gain: GainNode };
type Asset = keyof typeof SOUND_ASSETS;

/** One mixer per iPad. Assets are embedded by Vite for offline WKWebView playback. */
export class InstallationAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<Asset, AudioBuffer>();
  private voices = new Set<Voice>();
  private mixing: Voice | null = null;
  private riser: Voice | null = null;
  private generation = 0;
  private sequence: SoundSequence;
  private active = false;
  private sleepingCue = false;
  private lastType = -Infinity;
  private disposed = false;
  private loading: Promise<void> | null = null;
  private settings = { ...DEFAULT_SOUND_SETTINGS };
  private played = 0;
  constructor(private role: SoundRole) { this.sequence = new SoundSequence(role); }

  async prepare() {
    if (this.disposed) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.context.onstatechange = () => this.report();
    }
    if (!this.master) {
      this.master = this.context.createGain();
      this.master.gain.value = this.settings.master;
      this.master.connect(this.context.destination);
    }
    // Native WKWebView permits autoplay; web previews unlock on a user gesture.
    this.report();
    // iPadOS may interrupt a context during sleep without marking it suspended.
    if (this.context.state !== 'running') await this.context.resume();
    this.loading ??= Promise.all(Object.entries(SOUND_ASSETS).map(async ([key, url]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Audio: ${key} (${response.status})`);
      const buffer = await this.context!.decodeAudioData(await response.arrayBuffer());
      if (!this.disposed) this.buffers.set(key as Asset, buffer);
    })).then(() => {}).catch(error => {
      this.loading = null;
      throw error;
    });
    await this.loading;
    this.report();
  }

  private report() { reportAudio(this.context?.state ?? 'unprepared', this.buffers.size, this.played); }
  configure(value: SoundSettings) {
    this.settings = { ...value };
    if (this.master && this.context) this.master.gain.setTargetAtTime(value.master, this.context.currentTime, .03);
  }
  async test() { await this.prepare(); this.voice('panels', this.settings.panels); }

  private voice(asset: Asset, volume: number, options: { loop?: boolean; rate?: number; offset?: number; duration?: number } = {}) {
    const context = this.context, buffer = this.buffers.get(asset);
    if (!context || context.state !== 'running' || !buffer || !this.master) return null;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer;
    source.loop = options.loop ?? false;
    source.playbackRate.value = options.rate ?? 1;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(volume, context.currentTime + .008);
    source.connect(gain).connect(this.master);
    const voice = { source, gain };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice); source.disconnect(); gain.disconnect();
      if (this.mixing === voice) this.mixing = null;
      if (this.riser === voice) this.riser = null;
    };
    source.start(0, options.offset ?? 0, options.duration);
    this.played++; this.report();
    return voice;
  }

  private stopVoice(voice: Voice | null, immediate = false) {
    if (!voice || !this.context || !this.voices.has(voice)) return;
    this.voices.delete(voice);
    const now = this.context.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    if (immediate) { voice.gain.gain.setValueAtTime(0, now); voice.source.stop(now); return; }
    voice.gain.gain.setTargetAtTime(0, now, .012);
    voice.source.stop(now + .06);
  }

  private cue(cue: SoundCue) {
    if (cue === 'ding' || cue === 'failure') {
      this.stopVoice(this.riser, cue === 'ding'); this.riser = null;
      this.stopVoice(this.mixing, cue === 'ding'); this.mixing = null;
    }
    if (cue === 'riser') {
      this.riser = this.voice('riser', this.settings.riser);
      // Both voices end sharply on the audio clock; the story then holds silence.
      if (this.mixing && this.context) this.mixing.source.stop(this.context.currentTime + MIXING_FINALE.sound);
    } else {
      if (cue === 'sleep') this.sleepingCue = true;
      this.voice(cue, this.settings[cue],
        cue === 'sleep' ? { rate: .65 } : {});
    }
  }

  update(frame: SoundFrame) {
    if (this.disposed) return;
    if (this.sleepingCue && (!frame.available || frame.stage === 'standby')) return;
    if (frame.stage === 'standby') {
      if (isNativeHost()) return; // The shared native power event owns sound and screen shutdown.
      if (this.sequence.step(frame).includes('sleep') && !isNativeHost()) this.sleep();
      else if (!this.sleepingCue) this.stop();
      return;
    }
    this.active = frame.available;
    if (this.sleepingCue && frame.available) nativeCommand('wake-transition');
    this.sleepingCue = false;
    if (!frame.available) { this.stop(); return; }
    for (const cue of this.sequence.step(frame)) {
      const generation = this.generation, started = performance.now();
      // A canceled or slow decode must never play a stale cue in a new phase.
      void this.prepare().then(() => {
        if (!this.disposed && generation === this.generation && performance.now() - started < 400) this.cue(cue);
      }).catch(error => console.warn('Zvuk se nepodařilo připravit.', error));
    }
    if (this.role === 'center') {
      const { volume, rate } = mixingSound(frame);
      if (frame.stage === 'finishing' && frame.elapsed >= MIXING_FINALE.sound) {
        this.stopVoice(this.mixing, true); this.stopVoice(this.riser, true);
      }
      if (volume > 0 && !this.mixing && frame.stage !== 'finishing') this.mixing = this.voice('mixing', 0, { loop: true, rate });
      if (this.mixing && this.context) {
        this.mixing.gain.gain.setTargetAtTime(volume * this.settings.mixing / .32, this.context.currentTime, .12);
        this.mixing.source.playbackRate.setTargetAtTime(rate, this.context.currentTime, .18);
      }
    }
  }

  type() {
    if (!this.active || document.hidden || isNativePaused() || performance.now() - this.lastType < 35) return;
    this.lastType = performance.now();
    const buffer = this.buffers.get('typing');
    if (!buffer) return;
    const voice = this.voice('typing', this.settings.typing, { offset: Math.random() * Math.max(0, buffer.duration - .07), duration: .055 });
    if (voice && this.context) {
      const now = this.context.currentTime;
      voice.gain.gain.linearRampToValueAtTime(0, now + .05);
    }
  }

  sleep() {
    if (this.sleepingCue || !this.active) return;
    nativeCommand('sleep-transition');
    this.stop(); this.sequence.reset(); this.sleepingCue = true;
    if (!document.hidden) this.cue('sleep');
  }
  stop() {
    this.generation++;
    this.active = false;
    for (const voice of this.voices) this.stopVoice(voice);
    this.mixing = null; this.riser = null;
  }
  reset() {
    if (!this.sleepingCue) this.stop();
    this.sequence.reset();
  }
  dispose() {
    this.stop(); this.disposed = true;
    if (this.context) void this.context.close().catch(() => {});
    this.buffers.clear();
  }
}

export function bindInstallationAudio(player: InstallationAudio) {
  const unbindSettings = bindSoundSettings(value => player.configure(value));
  const prepare = () => { void player.prepare().catch(error => console.warn('Zvuk se nepodařilo připravit.', error)); };
  const power = () => { if (document.hidden) player.stop(); else if (isNativePaused()) player.sleep(); else prepare(); };
  const typing = () => player.type();
  const test = (event: Event) => { void player.test().catch(error => console.warn('Zvuk se nepodařilo připravit.', error)); event.preventDefault(); };
  window.addEventListener('pointerdown', prepare);
  window.addEventListener('keydown', prepare);
  window.addEventListener('michas:power', power);
  window.addEventListener('michas:typing', typing);
  window.addEventListener('michas:sound-test', test);
  document.addEventListener('visibilitychange', power);
  if (isNativeHost()) prepare();
  return () => {
    window.removeEventListener('pointerdown', prepare);
    window.removeEventListener('keydown', prepare);
    window.removeEventListener('michas:power', power);
    window.removeEventListener('michas:typing', typing);
    window.removeEventListener('michas:sound-test', test);
    document.removeEventListener('visibilitychange', power);
    player.dispose();
    unbindSettings();
  };
}
