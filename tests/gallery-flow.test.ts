import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceGalleryFlow, emptyGalleryFlow, galleryStageLayout, type GalleryFlow } from '../lib/gallery-flow';

const now = Date.parse('2026-11-05T18:00:00Z');
const row = (id: string, age = 3600000) => ({ id, created_at: new Date(now - age).toISOString() });
function randomSource(seed = 1) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

test('large archives keep only a screen-sized set of distinct, readable portraits', () => {
  const rows = Array.from({ length: 10000 }, (_, index) => row(String(index)));
  for (const [width, height] of [[280, 600], [984, 728], [1880, 1040], [2520, 1040], [600, 150]]) {
    const layout = galleryStageLayout(width, height);
    const state = advanceGalleryFlow(emptyGalleryFlow(), rows, now, layout.capacity, new Set(), randomSource());
    assert.ok(layout.size >= 88 && layout.size <= Math.min(width, height));
    assert.ok(state.flights.length > 0 && state.flights.length <= 12);
    assert.equal(state.flights.length, layout.capacity);
    assert.equal(new Set(state.flights.map(flight => flight.id)).size, state.flights.length);
  }
  assert.equal(galleryStageLayout(0, 100).capacity, 0);
});

test('vertical installation screens use large portraits instead of filling the height with small circles', () => {
  for (const [width, height] of [[994, 1470], [944, 1560], [650, 1100]]) {
    const layout = galleryStageLayout(width, height);
    assert.ok(layout.size >= width * .3);
    assert.ok(layout.size <= 360);
    assert.ok(layout.capacity >= 4 && layout.capacity <= 8);
  }
});

test('newest portrait appears on initial load and a live arrival immediately replaces a slot', () => {
  const rows = Array.from({ length: 100 }, (_, index) => row(String(index)));
  const random = randomSource();
  let state = advanceGalleryFlow(emptyGalleryFlow(), [...rows, row('latest', 1000)], now, 4, new Set(), random);
  assert.ok(state.flights.some(flight => flight.id === 'latest' && flight.delay === 0));
  const keys = state.flights.map(flight => flight.key);
  const updated = [...rows, row('latest', 1000), row('new', 0)];
  state = advanceGalleryFlow(state, updated, now + 100, 4, new Set(), random);
  assert.ok(state.flights.some(flight => flight.id === 'new' && flight.delay === 0));
  const stable = advanceGalleryFlow(state, [...updated], now + 200, 4, new Set(), random);
  assert.deepEqual(stable.flights, state.flights, 'polling must not replay arrivals or restart active animations');
  assert.equal(state.flights.filter(flight => keys.includes(flight.key)).length, 3);
});

test('layout measurement does not consume arrivals before there is room to display them', () => {
  const rows = [row('latest', 0)];
  let state = advanceGalleryFlow(emptyGalleryFlow(), rows, now, 0);
  assert.equal(state.known.size, 0);
  state = advanceGalleryFlow(state, rows, now + 100, 1);
  assert.equal(state.flights[0].id, 'latest');
  assert.ok(state.flights[0].delay === 0);
});

test('an arrival replaces the portrait nearest expiry and leaves other stationary slots unchanged', () => {
  const rows = [row('a'), row('b'), row('latest', 0)];
  const random = randomSource();
  const initial = advanceGalleryFlow(emptyGalleryFlow(), rows, now, 3, new Set(), random);
  const nearest = initial.flights.reduce((a, b) => a.expiresAt < b.expiresAt ? a : b);
  const next = advanceGalleryFlow(initial, [...rows, row('new', 0)], now + 100, 3, new Set(), random);
  assert.ok(!next.flights.some(flight => flight.id === nearest.id));
  for (const flight of next.flights) {
    const before = initial.flights.find(item => item.id === flight.id);
    if (before) assert.equal(flight.slot, before.slot);
  }
  assert.equal(next.flights.find(flight => flight.id === 'new')!.slot, nearest.slot);
});

test('polling batches display all admitted arrivals even when their flights expire sooner', () => {
  const rows = [row('old-a'), row('old-b')];
  let state = advanceGalleryFlow(emptyGalleryFlow(), rows, now, 2, new Set(), randomSource());
  state = { ...state, flights: state.flights.map(flight => ({ ...flight, expiresAt: now + 40000 })) };
  const incoming = [...rows, row('new-a', 1000), row('new-b', 0)];
  state = advanceGalleryFlow(state, incoming, now + 100, 2, new Set(), () => 0);
  assert.deepEqual(new Set(state.flights.map(flight => flight.id)), new Set(['new-a', 'new-b']));
});

test('overflow waits for readable visits and every queued portrait receives a turn', () => {
  const rows = [row('old-a'), row('old-b')];
  const random = randomSource();
  let state = advanceGalleryFlow(emptyGalleryFlow(), rows, now, 2, new Set(), random);
  const captures = Array.from({ length: 7 }, (_, index) => row(`new-${index}`, index * 1000));
  const incoming = [...rows, ...captures];
  state = advanceGalleryFlow(state, incoming, now + 100, 2, new Set(), random);
  const firstVisit = state.flights.map(flight => flight.key);
  const seen = new Set(state.flights.map(flight => flight.id));
  state = advanceGalleryFlow(state, incoming, now + 1100, 2, new Set(), random);
  assert.deepEqual(state.flights.map(flight => flight.key), firstVisit, 'overflow must not turn arrivals into one-second flashes');
  for (let visit = 1; visit <= 4; visit++) {
    state = advanceGalleryFlow(state, incoming, now + 100 + visit * 7000, 2, new Set(), random);
    state.flights.forEach(flight => seen.add(flight.id));
    assert.equal(state.flights.length, 2);
    assert.equal(new Set(state.flights.map(flight => flight.id)).size, 2);
  }
  assert.ok(captures.every(capture => seen.has(capture.id)));
});

test('old portraits keep returning while fresh portraits get a temporary probability boost', () => {
  const rows = [row('old'), row('recent', 0)];
  function samples(time: number) {
    const random = randomSource();
    let recent = 0;
    for (let index = 0; index < 4000; index++) {
      // The initial archive is already known; this is a normal replacement choice.
      const state: GalleryFlow = { ...emptyGalleryFlow(), known: new Set(rows.map(item => item.id)), updatedAt: time };
      const next = advanceGalleryFlow(state, rows, time, 1, new Set(), random);
      if (next.flights[0].id === 'recent') recent++;
    }
    return recent / 4000;
  }
  assert.ok(samples(now) > .84 && samples(now) < .93);
  assert.ok(samples(now + 360000) > .45 && samples(now + 360000) < .55);
});

test('hovered or focused portraits stay available and new arrivals wait if every slot is held', () => {
  const rows = [row('one')];
  const random = randomSource();
  let state = advanceGalleryFlow(emptyGalleryFlow(), rows, now, 1, new Set(), random);
  const key = state.flights[0].key;
  state = advanceGalleryFlow(state, [...rows, row('new', 0)], now + 60000, 1, new Set(['one']), random);
  assert.equal(state.flights[0].key, key);
  assert.ok(state.flights[0].expiresAt > now + 60000);
  state = advanceGalleryFlow(state, [...rows, row('new', 0)], now + 61000, 1, new Set(), random);
  assert.equal(state.flights[0].id, 'new');
});

test('deletion, smaller screens, empty archives and long-running rotation remain bounded', () => {
  let rows = Array.from({ length: 40 }, (_, index) => row(String(index)));
  const random = randomSource();
  let state = advanceGalleryFlow(emptyGalleryFlow(), rows, now, 12, new Set(), random);
  const deleted = state.flights[0].id;
  rows = rows.filter(item => item.id !== deleted);
  state = advanceGalleryFlow(state, rows, now + 1000, 3, new Set(), random);
  assert.equal(state.flights.length, 3);
  assert.equal(new Set(state.flights.map(flight => flight.slot)).size, 3);
  assert.ok(state.flights.every(flight => flight.slot >= 0 && flight.slot < 3));
  assert.ok(!state.flights.some(flight => flight.id === deleted));
  const seen = new Set<string>();
  for (let tick = 1; tick <= 300; tick++) {
    state = advanceGalleryFlow(state, rows, now + tick * 30000, 3, new Set(), random);
    assert.equal(state.flights.length, 3);
    state.flights.forEach(flight => seen.add(flight.id));
  }
  assert.equal(seen.size, rows.length, 'the older archive continues to circulate');
  state = advanceGalleryFlow(state, [], now + 10000000, 3, new Set(), random);
  assert.equal(state.flights.length, 0);
  assert.equal(state.shown.size, 0);
});
