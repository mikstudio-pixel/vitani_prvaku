/// <reference types="vite/client" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Module } from 'node:module';

// The Node test runner cannot import WAV files. Replace only Vite's URL map;
// exercise the real mixer preparation and its concurrent-promise lifecycle.
const assetPath = require.resolve('../web/sounds/assets');
const assetModule = new Module(assetPath);
assetModule.exports = { SOUND_ASSETS: { panels: '/panels.wav' } };
require.cache[assetPath] = assetModule;
const { InstallationAudio } = require('../lib/installation-audio') as typeof import('../lib/installation-audio');

void test('failed fetch and decode can each recover on the next audio preparation', async () => {
  const originalFetch = globalThis.fetch;
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  let fetches = 0, decodes = 0, failure: 'fetch' | 'decode' | null = 'fetch';
  class Context {
    state = 'running';
    destination = {};
    createGain() { return { gain: { value: 0 }, connect() {} }; }
    async decodeAudioData() {
      decodes++;
      if (failure === 'decode') throw new Error('decode failed');
      return {};
    }
    async close() {}
  }
  Object.defineProperty(globalThis, 'AudioContext', { value: Context, configurable: true });
  globalThis.fetch = async () => {
    fetches++;
    return { ok: failure !== 'fetch', status: failure === 'fetch' ? 503 : 200,
      arrayBuffer: async () => new ArrayBuffer(0) } as Response;
  };
  const player = new InstallationAudio('center');
  try {
    await assert.rejects(player.prepare(), /503/);
    assert.equal(fetches, 1);
    failure = 'decode';
    await assert.rejects(player.prepare(), /decode failed/);
    assert.equal(fetches, 2);
    assert.equal(decodes, 1);
    failure = null;
    await Promise.all([player.prepare(), player.prepare()]);
    assert.equal(fetches, 3, 'Concurrent gestures must share one retry');
    assert.equal(decodes, 2);
    await player.prepare();
    assert.equal(fetches, 3, 'A successful preparation stays cached');
  } finally {
    player.dispose();
    globalThis.fetch = originalFetch;
    if (originalAudio) Object.defineProperty(globalThis, 'AudioContext', originalAudio);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
    delete require.cache[assetPath];
  }
});
