import { formatKWD } from '@ncg/shared';
import { describe, expect, it } from 'vitest';
import { cartTotals, linePacks, lineTotalFils } from './cartMath';

// Product C from the brief
const one = { unitsPerBundle: 1, bundlePriceFils: 5500 };
const four = { unitsPerBundle: 4, bundlePriceFils: 19500 };
const twelve = { unitsPerBundle: 12, bundlePriceFils: 55000 };

describe('cart math', () => {
  it("brief example: 2 × '4 Packs' at 19.500 = 8 packs = 39.000 KWD", () => {
    const line = { ...four, bundles: 2 };
    expect(linePacks(line)).toBe(8);
    expect(formatKWD(lineTotalFils(line))).toBe('39.000 KWD');
  });

  it('C: 1×1 + 2×4 + 1×12 = 99.500 KWD / 21 packs', () => {
    const totals = cartTotals([
      { ...one, bundles: 1 },
      { ...four, bundles: 2 },
      { ...twelve, bundles: 1 },
    ]);
    expect(formatKWD(totals.subtotalFils)).toBe('99.500 KWD');
    expect(totals).toEqual({ subtotalFils: 99500, totalBundles: 4, totalPacks: 21, lineCount: 3 });
  });

  it('empty cart totals are zero', () => {
    expect(cartTotals([])).toEqual({
      subtotalFils: 0,
      totalBundles: 0,
      totalPacks: 0,
      lineCount: 0,
    });
  });

  it('refuses non-integer input (no float math sneaking in)', () => {
    expect(() => lineTotalFils({ bundlePriceFils: 19.5, bundles: 2 })).toThrow(TypeError);
    expect(() => linePacks({ unitsPerBundle: 4, bundles: 1.5 })).toThrow(TypeError);
  });
});
