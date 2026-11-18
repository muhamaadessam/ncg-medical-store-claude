import { describe, expect, it } from 'vitest';
import {
  addLine,
  clampBundles,
  isValidBundles,
  removeLines,
  sanitizeLines,
  setLineBundles,
} from './cartLogic';
import { CART_STORAGE_KEY, createCartStore } from './cartStore';

const four = { tierId: 'tier-4', productId: 'vit-d' };
const one = { tierId: 'tier-1', productId: 'vit-d' };

describe('cart lines', () => {
  it('keys lines by tierId: different tiers of one product are separate lines', () => {
    let { lines } = addLine([], four);
    ({ lines } = addLine(lines, one));
    expect(lines).toEqual([
      { ...four, bundles: 1 },
      { ...one, bundles: 1 },
    ]);
  });

  it('adding the same tier again increases bundles on the same line', () => {
    let { lines } = addLine([], four);
    ({ lines } = addLine(lines, four));
    expect(lines).toEqual([{ ...four, bundles: 2 }]);
  });

  it('caps at 99 bundles and reports it', () => {
    const start = [{ ...four, bundles: 98 }];
    const result = addLine(start, four, 5);
    expect(result.lines[0]!.bundles).toBe(99);
    expect(result.capped).toBe(true);
    expect(addLine(start, four, 1).capped).toBe(false);
  });

  it('clamps invalid quantities into 1–99', () => {
    expect(clampBundles(0)).toBe(1);
    expect(clampBundles(-5)).toBe(1);
    expect(clampBundles(150)).toBe(99);
    expect(clampBundles(2.7)).toBe(2);
    expect(clampBundles('7')).toBe(7);
    expect(clampBundles('')).toBe(1);
    expect(clampBundles('abc')).toBe(1);
    expect(clampBundles(Number.NaN)).toBe(1);
    expect(clampBundles(null)).toBe(1);
    expect(isValidBundles(1)).toBe(true);
    expect(isValidBundles(99)).toBe(true);
    expect(isValidBundles(0)).toBe(false);
    expect(isValidBundles(100)).toBe(false);
    expect(isValidBundles(1.5)).toBe(false);
  });

  it('setLineBundles clamps and only touches the given tier', () => {
    const lines = [
      { ...four, bundles: 2 },
      { ...one, bundles: 3 },
    ];
    expect(setLineBundles(lines, 'tier-4', 500)).toEqual([
      { ...four, bundles: 99 },
      { ...one, bundles: 3 },
    ]);
    expect(setLineBundles(lines, 'tier-4', 'x')[0]!.bundles).toBe(1);
  });

  it('removeLines drops lines by tier', () => {
    expect(
      removeLines(
        [
          { ...four, bundles: 2 },
          { ...one, bundles: 1 },
        ],
        ['tier-4'],
      ),
    ).toEqual([{ ...one, bundles: 1 }]);
  });

  it('sanitizes stored data: drops junk, merges duplicates, clamps', () => {
    expect(
      sanitizeLines([
        { tierId: 'a', productId: 'p', bundles: 2 },
        { tierId: 'a', productId: 'p', bundles: 3 },
        { tierId: 'b', productId: 'p', bundles: 1000 },
        { tierId: '', productId: 'p', bundles: 1 },
        { productId: 'p' },
        'junk',
        null,
      ]),
    ).toEqual([
      { tierId: 'a', productId: 'p', bundles: 5 },
      { tierId: 'b', productId: 'p', bundles: 99 },
    ]);
    expect(sanitizeLines({ not: 'an array' })).toEqual([]);
  });
});

describe('cart store', () => {
  const memoryStorage = (initial?: string) => {
    const data = new Map<string, string>(initial ? [[CART_STORAGE_KEY, initial]] : []);
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      data,
    };
  };

  it('persists to storage and notifies subscribers', () => {
    const storage = memoryStorage();
    const store = createCartStore(storage);
    let calls = 0;
    store.subscribe(() => calls++);
    store.add(four);
    store.add(four);
    expect(store.getLines()).toEqual([{ ...four, bundles: 2 }]);
    expect(JSON.parse(storage.data.get(CART_STORAGE_KEY)!)).toEqual([{ ...four, bundles: 2 }]);
    expect(calls).toBe(2);
  });

  it('survives corrupt storage and failing writes', () => {
    const store = createCartStore({
      getItem: () => '{not json',
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    });
    expect(store.getLines()).toEqual([]);
    expect(() => store.add(four)).not.toThrow();
    expect(store.getLines()).toHaveLength(1);
  });

  it('works without storage at all', () => {
    const store = createCartStore(undefined);
    store.add(one, 3);
    store.setBundles('tier-1', 0);
    expect(store.getLines()).toEqual([{ ...one, bundles: 1 }]);
    store.clear();
    expect(store.getLines()).toEqual([]);
  });
});
