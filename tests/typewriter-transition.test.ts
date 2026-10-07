import assert from 'node:assert/strict';
import test from 'node:test';
import { replacedByIncoming, type GlyphRegion } from '../lib/typewriter-transition';

const glyph = (x: number, width: number, y = 0): GlyphRegion => ({ x, width, y, height: 28 });

void test('a wide incoming letter erases every old letter it reaches, not just one character', () => {
  const old = [glyph(0, 8), glyph(10, 8), glyph(20, 8), glyph(30, 8)];
  const incoming = [glyph(0, 25)];
  assert.deepEqual(old.map(letter => replacedByIncoming(letter, incoming)), [true, true, true, false]);
});

void test('typing affects its own row and handles shifted lines without overlapping old ink', () => {
  assert.equal(replacedByIncoming(glyph(0, 20, 39), [glyph(0, 25)]), false);
  assert.equal(replacedByIncoming(glyph(0, 20, 20), [glyph(0, 25)]), true);
  assert.equal(replacedByIncoming(glyph(25, 20), [glyph(0, 25)]), false);
  assert.equal(replacedByIncoming(glyph(0, 20), []), false);
});
