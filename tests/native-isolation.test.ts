import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as bridge from '../lib/native-host';
import { DEFAULT_INTRO } from '../lib/intro-parameters';
import { DEFAULT_SOUND_SETTINGS } from '../lib/sound-settings';
import { DEFAULT_QR_ANIMATION } from '../lib/qr-animation-settings';

void test('browser compatibility exports never access an injected exhibition bridge', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const host = new Proxy({}, { get() { assert.fail('The event must not inspect the native host'); } });
  Object.defineProperty(globalThis, 'window', { value: host, configurable: true });
  try {
    assert.equal(bridge.isNativeHost(), false);
    assert.equal(bridge.isNativePaused(), false);
    bridge.nativeCommand('ready');
    bridge.nativeCommand('tilt', true);
    bridge.nativeCommand('sleep-transition');
    bridge.nativeCommand('wake-transition');
    bridge.nativeCommand('presentation-ready');
    bridge.completeSession();
    bridge.completeSimulation();
    bridge.reportSimulationReady(true);
    bridge.reportIntroSettings(DEFAULT_INTRO, true);
    bridge.reportSoundSettings(DEFAULT_SOUND_SETTINGS, true);
    bridge.reportAudio('running', 10, 1);
    bridge.reportMixingSensitivity(1, true);
    bridge.reportFrameRate(60, true);
    bridge.reportQrAnimation(DEFAULT_QR_ANIMATION, true);
    bridge.reportCalibration('center', { x: 0, y: 0, scale: 1 }, true);
    assert.equal(bridge.setRemoteCalibration('left', { x: 0, y: 0, scale: 1 }), 0);
    bridge.publishTrayState({ phase: 'ready', tiltX: 0, tiltY: 0, activity: 0, oil: 0, elapsed: 0 });
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

void test('application source contains no Designblok native globals, handlers or legacy events', () => {
  for (const directory of ['app', 'components', 'lib', 'web']) {
    for (const file of readdirSync(directory, { recursive: true }) as string[]) {
      if (!/\.tsx?$/.test(file)) continue;
      const path = join(directory, file);
      assert.doesNotMatch(readFileSync(path, 'utf8'), /__michasNative|messageHandlers|\.postMessage\(|michas:/, path);
    }
  }
});
