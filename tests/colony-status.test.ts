import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colonyValues } from '../lib/colony-status';

void test('colony degrades by default and can reverse the same cascade', () => {
  assert.deepEqual(colonyValues(0).map(value => value.label), ['Vysoká', 'Fantastická', '8 hodin', 'Uklizená', 'Top strop']);
  assert.deepEqual(colonyValues(1).map(value => value.label), ['Nízká', 'Nevím co dělám', '4 hodiny', 'Kritický', 'Top strop']);
  for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
    assert.deepEqual(colonyValues(progress, 'degrade'), colonyValues(1 - progress, 'improve'));
  }
  assert.deepEqual(colonyValues(Number.NaN), colonyValues(0));
});
