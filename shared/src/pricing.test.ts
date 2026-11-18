import { describe, expect, it } from 'vitest';
import { baselineTier, bestValueTierId, perPackFils, savingsPercent } from './pricing';

const t = (id: string, unitsPerBundle: number, bundlePriceFils: number) => ({
  id,
  unitsPerBundle,
  bundlePriceFils,
});

// Product C from the brief
const one = t('one', 1, 5500);
const four = t('four', 4, 19500);
const twelve = t('twelve', 12, 55000);

describe('perPackFils', () => {
  it('divides with half-up integer rounding', () => {
    expect(perPackFils(four)).toBe(4875);
    expect(perPackFils(twelve)).toBe(4583); // 4583.33
    expect(perPackFils(t('x', 3, 17000))).toBe(5667); // 5666.67
    expect(perPackFils(t('x', 2, 3))).toBe(2); // 1.5 rounds up
    expect(perPackFils(one)).toBe(5500);
  });
});

describe('bestValueTierId', () => {
  it('picks the lowest per-pack price', () => {
    expect(bestValueTierId([one, four, twelve])).toBe('twelve');
    expect(bestValueTierId([twelve, one, four])).toBe('twelve');
  });

  it('is undefined for a single tier or when all tiers cost the same per pack', () => {
    expect(bestValueTierId([one])).toBeUndefined();
    expect(bestValueTierId([])).toBeUndefined();
    expect(bestValueTierId([t('a', 1, 1000), t('b', 3, 3000)])).toBeUndefined();
  });

  it('breaks ties at the lowest price in favour of the bigger bundle', () => {
    expect(bestValueTierId([t('a', 1, 2000), t('b', 2, 2000), t('c', 4, 4000)])).toBe('c');
  });

  it('uses exact comparison where rounding would hide a difference', () => {
    // 10.000/3 = 3.3333 vs 6.667/2 = 3.3335 → per-pack both display 3.333, 3 packs is cheaper
    expect(bestValueTierId([t('two', 2, 6667), t('three', 3, 10000)])).toBe('three');
  });
});

describe('savingsPercent / baselineTier', () => {
  it('computes whole-percent savings against the dearest tier', () => {
    expect(baselineTier([one, four, twelve])).toBe(one);
    expect(savingsPercent(four, one)).toBe(11); // 11.36%
    expect(savingsPercent(twelve, one)).toBe(16); // 16.67% rounded down
    expect(savingsPercent(one, one)).toBe(0);
    expect(savingsPercent(one, four)).toBe(0);
  });
});
