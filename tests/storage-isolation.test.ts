import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindIntroSettings } from '../lib/intro-settings';
import { DEFAULT_INTRO, applyIntroSettings } from '../lib/intro-parameters';
import { bindMixingSensitivity } from '../lib/mixing-settings';
import { MIXING_SENSITIVITY } from '../lib/mixing-sensitivity';
import { bindFrameRate } from '../lib/frame-rate-settings';
import { DEFAULT_FRAME_RATE } from '../lib/frame-rate';
import { bindQrAnimation } from '../lib/qr-settings';
import { DEFAULT_QR_ANIMATION } from '../lib/qr-animation-settings';
import { bindSoundSettings, DEFAULT_SOUND_SETTINGS } from '../lib/sound-settings';
import { calibrationKey } from '../lib/display-calibration';

void test('event settings ignore and preserve exhibition settings on the same origin', () => {
  const original = new Map([
    ['michas.intro-settings.v3', JSON.stringify({ ...DEFAULT_INTRO, 'story.detected': 4 })],
    ['michas.intro-settings.v2', JSON.stringify(DEFAULT_INTRO)],
    ['michas.intro-settings.v1', JSON.stringify(DEFAULT_INTRO)],
    ['michas.mixing-sensitivity', '200'],
    ['michas.frame-rate', '30'],
    ['michas.qr-animation', JSON.stringify({ revealSeconds: 30, dissolvePercent: 200 })],
    ['michas.sound-settings.v1', JSON.stringify({ ...DEFAULT_SOUND_SETTINGS, master: 0 })],
  ]);
  const values = new Map(original);
  const accesses: string[] = [];
  const storage = {
    getItem(key: string) { accesses.push(key); return values.get(key) ?? null; },
    setItem(key: string, value: string) { accesses.push(key); values.set(key, value); },
  };
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const win = Object.assign(new EventTarget(), { localStorage: storage });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  const cleanup: (() => void)[] = [];
  try {
    cleanup.push(bindIntroSettings());
    cleanup.push(bindMixingSensitivity(value => assert.equal(value, MIXING_SENSITIVITY.default)));
    cleanup.push(bindFrameRate(value => assert.equal(value, DEFAULT_FRAME_RATE)));
    cleanup.push(bindQrAnimation(value => assert.deepEqual(value, DEFAULT_QR_ANIMATION)));
    cleanup.push(bindSoundSettings(value => assert.deepEqual(value, DEFAULT_SOUND_SETTINGS)));
    assert.ok(accesses.length > 0);
    assert.ok(accesses.every(key => key.startsWith('vitani-prvaku.')), accesses.join(', '));
    for (const [key, value] of original) assert.equal(values.get(key), value);
    for (const role of ['center', 'indicator', 'left', 'right'] as const) {
      assert.ok(calibrationKey(role).startsWith('vitani-prvaku.'));
    }
  } finally {
    cleanup.forEach(unbind => unbind());
    applyIntroSettings(DEFAULT_INTRO);
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
