/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { plantGrowth } from './plant-growth';

describe('session-driven plant growth', () => {
  test('begins as a seed and finishes as a full fruiting plant', () => {
    expect(plantGrowth(0)).toEqual({ progress: 0, seed: 1, stem: 0, flowers: 0, fruit: 0 });
    expect(plantGrowth(1)).toEqual({ progress: 1, seed: 0, stem: 1, flowers: 0, fruit: 1 });
  });
  test('sprouts, grows leaves, flowers, then fruits in order', () => {
    expect(plantGrowth(0.15).stem).toBeGreaterThan(0);
    expect(plantGrowth(0.5).stem).toBeGreaterThan(plantGrowth(0.15).stem);
    expect(plantGrowth(0.75).flowers).toBeGreaterThan(0);
    expect(plantGrowth(0.75).fruit).toBe(0);
    expect(plantGrowth(0.95).fruit).toBeGreaterThan(0);
  });
  test('same elapsed progress produces identical growth after pause or reopening', () => {
    expect(plantGrowth(0.42)).toEqual(plantGrowth(0.42));
    expect(plantGrowth(-1).stem).toBe(0);
    expect(plantGrowth(2).fruit).toBe(1);
    expect(plantGrowth(Number.NaN).stem).toBe(0);
  });
});