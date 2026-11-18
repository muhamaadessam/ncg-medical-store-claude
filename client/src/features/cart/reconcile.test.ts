import { describe, expect, it } from 'vitest';
import { thermometer, vitaminD } from '@/test/fixtures';
import { reconcileCart, type ProductLookup } from './reconcile';

const lines = [
  { tierId: 'tier-4', productId: vitaminD.id, bundles: 2 },
  { tierId: 'tier-1', productId: vitaminD.id, bundles: 1 },
  { tierId: 'thermo-1', productId: thermometer.id, bundles: 3 },
];

const lookupFrom =
  (entries: Record<string, ProductLookup>) =>
  (id: string): ProductLookup =>
    entries[id] ?? { status: 'pending' };

describe('reconcileCart', () => {
  it('joins lines with fresh product and tier data', () => {
    const result = reconcileCart(
      lines,
      lookupFrom({
        [vitaminD.id]: { status: 'loaded', product: vitaminD },
        [thermometer.id]: { status: 'loaded', product: thermometer },
      }),
    );
    expect(result.items.map((i) => [i.tier.label, i.bundles, i.tier.bundlePriceFils])).toEqual([
      ['4 Packs', 2, 19500],
      ['1 Pack', 1, 5500],
      ['1 Pack', 3, 3750],
    ]);
    expect(result.missingTierIds).toEqual([]);
  });

  it('marks a tier deleted in the admin as missing', () => {
    const withoutFour = { ...vitaminD, tiers: vitaminD.tiers.filter((t) => t.id !== 'tier-4') };
    const result = reconcileCart(
      lines,
      lookupFrom({
        [vitaminD.id]: { status: 'loaded', product: withoutFour },
        [thermometer.id]: { status: 'loaded', product: thermometer },
      }),
    );
    expect(result.missingTierIds).toEqual(['tier-4']);
    expect(result.items).toHaveLength(2);
  });

  it('marks every line of a deleted product (404) as missing', () => {
    const result = reconcileCart(
      lines,
      lookupFrom({
        [vitaminD.id]: { status: 'not-found' },
        [thermometer.id]: { status: 'loaded', product: thermometer },
      }),
    );
    expect(result.missingTierIds).toEqual(['tier-4', 'tier-1']);
  });

  it('never drops lines while loading or after a network error', () => {
    const result = reconcileCart(
      lines,
      lookupFrom({ [vitaminD.id]: { status: 'error' }, [thermometer.id]: { status: 'pending' } }),
    );
    expect(result.missingTierIds).toEqual([]);
    expect(result.unresolvedTierIds).toEqual(['tier-4', 'tier-1', 'thermo-1']);
  });
});
