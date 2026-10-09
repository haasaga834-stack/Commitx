import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { plantGrowth } from './plant-growth';

describe('session-driven plant growth', () => {
  test('begins as a seed and finishes as a full fruiting plant', () => {
    assert.deepEqual(plantGrowth(0), { progress: 0, seed: 1, stem: 0, flowers: 0, fruit: 0 });
    assert.deepEqual(plantGrowth(1), { progress: 1, seed: 0, stem: 1, flowers: 0, fruit: 1 });
  });
  test('sprouts, grows leaves, flowers, then fruits in order', () => {
    assert.ok(plantGrowth(0.15).stem > 0);
    assert.ok(plantGrowth(0.5).stem > plantGrowth(0.15).stem);
    assert.ok(plantGrowth(0.75).flowers > 0);
    assert.equal(plantGrowth(0.75).fruit, 0);
    assert.ok(plantGrowth(0.95).fruit > 0);
  });
  test('same elapsed progress produces identical growth after pause or reopening', () => {
    assert.deepEqual(plantGrowth(0.42), plantGrowth(0.42));
    assert.equal(plantGrowth(-1).stem, 0);
    assert.equal(plantGrowth(2).fruit, 1);
    assert.equal(plantGrowth(Number.NaN).stem, 0);
  });
});