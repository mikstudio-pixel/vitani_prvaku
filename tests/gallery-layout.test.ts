import test from 'node:test';
import assert from 'node:assert/strict';
import { galleryLayout } from '../lib/gallery-layout';

test('all portraits fit one screen on landscape and portrait displays', () => {
  for (const [width, height] of [[280, 600], [984, 728], [1880, 1040], [2520, 1040]]) {
    for (const count of [0, 1, 2, 3, 5, 7, 9, 12, 17, 30, 99, 100, 999, 1000]) {
      const layout = galleryLayout(count, width, height);
      assert.ok(layout.columns * layout.rows >= count);
      assert.ok(layout.rows <= 2);
      assert.ok(layout.size * layout.columns + layout.gap * (layout.columns - 1) <= width + .001);
      assert.ok(layout.size * layout.rows + layout.gap * (layout.rows - 1) <= height + .001);
      assert.ok(layout.size > 0);
      assert.equal(layout.positions.length, count);
      for (const position of layout.positions) {
        assert.ok(position.column >= 1 && position.column + 1 <= layout.columns * 2);
        assert.ok(position.row >= 1 && position.row <= layout.rows);
      }
    }
  }
});

test('three portraits form a centered triangle even on a wide display', () => {
  for (const [width, height] of [[984, 728], [2520, 1040], [280, 600], [0, 0]]) {
    const layout = galleryLayout(3, width, height);
    assert.equal(layout.columns, 2);
    assert.equal(layout.rows, 2);
    assert.deepEqual(layout.positions, [{ row: 1, column: 1 }, { row: 1, column: 3 }, { row: 2, column: 2 }]);
  }
});

test('odd counts stay in two centered rows without overlap', () => {
  for (const count of [5, 7, 9, 17, 99]) {
    const layout = galleryLayout(count, 1880, 1040);
    assert.equal(layout.rows, 2);
    assert.equal(layout.positions.filter(position => position.row === 1).length, Math.ceil(count / 2));
    assert.equal(layout.positions.filter(position => position.row === 2).length, Math.floor(count / 2));
    for (let row = 1; row <= layout.rows; row++) {
      const positions = layout.positions.filter(position => position.row === row);
      assert.equal(positions[0].column + positions.at(-1)!.column + 1, layout.columns * 2 + 1);
      for (let index = 1; index < positions.length; index++) assert.equal(positions[index].column - positions[index - 1].column, 2);
    }
  }
});
