import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PortraitCamera, type CameraState } from '../lib/portrait-camera';

function fixture(getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>) {
  const track = Object.assign(new EventTarget(), { readyState: 'live', enabled: true, muted: false, getSettings: () => ({ facingMode: 'user' }), stop() { this.readyState = 'ended'; } });
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
  const video = { muted: false, playsInline: false, srcObject: null, readyState: 2, videoWidth: 1280, videoHeight: 720, play: async () => {}, pause: () => {} } as unknown as HTMLVideoElement;
  const states: CameraState[] = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: getUserMedia ?? (async constraints => { assert.equal(constraints.audio, false); assert.deepEqual((constraints.video as MediaTrackConstraints).facingMode, { ideal: 'user' }); return stream; }) } } });
  const camera = new PortraitCamera(video, state => states.push(state));
  return { camera, video, track, stream, states, restore() { camera.stop(); if (previous) Object.defineProperty(globalThis, 'navigator', previous); else Reflect.deleteProperty(globalThis, 'navigator'); } };
}
void test('camera prepares video only, refuses muted frames and stops on shutdown', async () => {
  const f = fixture();
  try {
    await f.camera.prepare(); assert.equal(f.states.at(-1)?.phase, 'ready'); assert.equal(f.video.muted, true); assert.equal(f.video.playsInline, true);
    f.track.muted = true; assert.throws(() => f.camera.capture());
    f.camera.stop(); assert.equal(f.track.readyState, 'ended'); assert.equal(f.video.srcObject, null);
    assert.throws(() => f.camera.capture());
  } finally { f.restore(); }
});
void test('a camera permission that arrives after cancellation is stopped', async () => {
  let resolve!: (stream: MediaStream) => void;
  const f = fixture(() => new Promise(done => { resolve = done; }));
  try {
    const preparing = f.camera.prepare(); f.camera.stop(); resolve(f.stream); await preparing;
    assert.equal(f.track.readyState, 'ended'); assert.equal(f.video.srcObject, null); assert.equal(f.states.at(-1)?.phase, 'off');
  } finally { f.restore(); }
});
void test('permission denial can be retried and track interruption resets readiness', async () => {
  let attempt = 0;
  const f = fixture(async () => { if (++attempt === 1) throw new DOMException('denied', 'NotAllowedError'); return f.stream; });
  try {
    await f.camera.prepare(); assert.equal(f.states.at(-1)?.phase, 'error');
    await f.camera.prepare(); assert.equal(f.states.at(-1)?.phase, 'ready');
    f.track.dispatchEvent(new Event('ended')); assert.equal(f.states.at(-1)?.phase, 'error'); assert.equal(f.video.srcObject, null);
  } finally { f.restore(); }
});
void test('photograph is center cropped, selfie mirrored and returned only as pixels', async () => {
  const f = fixture(); const calls: unknown[][] = [];
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const image = { data: new Uint8ClampedArray(4), width: 1, height: 1 };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => ({ translate: (...args: unknown[]) => calls.push(['translate', ...args]), scale: (...args: unknown[]) => calls.push(['scale', ...args]), drawImage: (...args: unknown[]) => calls.push(['draw', ...args.slice(1)]), getImageData: () => image }) }) } });
  try {
    await f.camera.prepare(); assert.equal(f.camera.capture(), image);
    assert.deepEqual(calls, [['translate', 512, 0], ['scale', -1, 1], ['draw', 280, 0, 720, 720, 0, 0, 512, 512]]);
  } finally { f.restore(); if (original) Object.defineProperty(globalThis, 'document', original); else Reflect.deleteProperty(globalThis, 'document'); }
});
