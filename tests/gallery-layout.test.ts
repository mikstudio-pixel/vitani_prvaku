import test from 'node:test';
import assert from 'node:assert/strict';
import { galleryLayout } from '../lib/gallery-layout';

test('all portraits fit one screen on landscape and portrait displays', () => {
  for (const [width, height] of [[280, 600], [984, 728], [1880, 1040], [2520, 1040]]) {
    for (const count of [0, 1, 2, 3, 7, 12, 30, 100, 1000]) {
      const layout = galleryLayout(count, width, height);
      assert.ok(layout.columns * layout.rows >= count);
      assert.ok(layout.size * layout.columns + layout.gap * (layout.columns - 1) <= width + .001);
      assert.ok(layout.size * layout.rows + layout.gap * (layout.rows - 1) <= height + .001);
      assert.ok(layout.size > 0);
    }
  }
});
