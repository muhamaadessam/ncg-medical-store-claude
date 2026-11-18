import { describe, expect, it } from 'vitest';
import type { PricingTier } from '../db/schema';
import { planTierChanges } from './products';

const tier = (id: string, units: number, price: string, sortOrder: number, label = `${units}`) =>
  ({
    id,
    productId: 'p',
    label,
    unitsPerBundle: units,
    bundlePrice: price,
    sortOrder,
  }) as PricingTier;

describe('planTierChanges', () => {
  const existing = [
    tier('a', 1, '5.500', 0),
    tier('b', 4, '19.500', 1),
    tier('c', 12, '55.000', 2),
  ];

  it('keeps identical tiers untouched', () => {
    const plan = planTierChanges(
      existing,
      existing.map((t) => ({
        id: t.id,
        label: t.label,
        unitsPerBundle: t.unitsPerBundle,
        bundlePrice: t.bundlePrice,
      })),
    );
    expect(plan).toEqual({ deleteIds: [], insert: [], keepIds: ['a', 'b', 'c'] });
  });

  it('deletes removed and changed tiers, inserts changed and new ones', () => {
    const plan = planTierChanges(existing, [
      { id: 'a', label: '1', unitsPerBundle: 1, bundlePrice: '5.500' },
      { id: 'b', label: '4', unitsPerBundle: 4, bundlePrice: '18.000' }, // price changed
      { label: 'new', unitsPerBundle: 24, bundlePrice: '99.000' },
    ]);
    expect(plan.keepIds).toEqual(['a']);
    expect(plan.deleteIds).toEqual(['b', 'c']);
    expect(plan.insert.map((t) => [t.id === 'b', t.unitsPerBundle, t.sortOrder])).toEqual([
      [true, 4, 1],
      [false, 24, 2],
    ]);
  });

  it('gives a tier a new id when its bundle size changes', () => {
    const plan = planTierChanges(existing, [
      { id: 'a', label: '2', unitsPerBundle: 2, bundlePrice: '5.500' },
    ]);
    expect(plan.insert[0]!.id).not.toBe('a');
    expect(plan.deleteIds).toEqual(['a', 'b', 'c']);
  });

  it('treats a moved tier as changed (sort order)', () => {
    const plan = planTierChanges(existing, [
      { id: 'b', label: '4', unitsPerBundle: 4, bundlePrice: '19.500' },
      { id: 'a', label: '1', unitsPerBundle: 1, bundlePrice: '5.500' },
    ]);
    expect(plan.insert.map((t) => [t.id, t.sortOrder])).toEqual([
      ['b', 0],
      ['a', 1],
    ]);
  });
});
