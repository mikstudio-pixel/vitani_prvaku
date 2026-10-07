import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SOUND_SETTINGS, validSoundSettings, sameSoundSettings } from '../lib/sound-settings';

test('sound levels accept a complete zero/mute profile and reject partial, unknown or unsafe values', () => {
  assert(validSoundSettings(DEFAULT_SOUND_SETTINGS));
  const muted = Object.fromEntries(Object.keys(DEFAULT_SOUND_SETTINGS).map(key => [key, 0]));
  assert(validSoundSettings(muted));
  for (const value of [null, [], { master: .5 }, { ...DEFAULT_SOUND_SETTINGS, unknown: 1 },
    ...[NaN, Infinity, -.01, 1.01, true, '.5'].map(typing => ({ ...DEFAULT_SOUND_SETTINGS, typing }))]) assert(!validSoundSettings(value));
  assert(sameSoundSettings(DEFAULT_SOUND_SETTINGS, { ...DEFAULT_SOUND_SETTINGS }));
  assert(!sameSoundSettings(DEFAULT_SOUND_SETTINGS, { ...DEFAULT_SOUND_SETTINGS, panels: 0 }));
});
