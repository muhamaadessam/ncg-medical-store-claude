import { describe, expect, it } from 'vitest';
import { vitaminD } from '@/test/fixtures';
import { isProductFieldPath, perPackHint, toFormValues } from './productForm';

describe('product form helpers', () => {
  it('per-pack hint uses integer fils', () => {
    expect(perPackHint('19.5', 4)).toBe('4.875 KWD per pack');
    expect(perPackHint('55', 12)).toBe('4.583 KWD per pack');
    expect(perPackHint('3.75', 1)).toBe('3.750 KWD for 1 pack');
    expect(perPackHint('', 4)).toMatch(/^Enter units and price/);
    expect(perPackHint('1.2345', 4)).toMatch(/^Enter units and price/);
    expect(perPackHint('10', Number.NaN)).toMatch(/^Enter units and price/);
  });

  it('turns a product into form values with KWD price strings', () => {
    expect(toFormValues(vitaminD).tiers).toEqual([
      { id: 'tier-1', label: '1 Pack', unitsPerBundle: 1, bundlePrice: '5.500' },
      { id: 'tier-4', label: '4 Packs', unitsPerBundle: 4, bundlePrice: '19.500' },
      { id: 'tier-12', label: '12 Packs', unitsPerBundle: 12, bundlePrice: '55.000' },
    ]);
    expect(toFormValues().tiers).toHaveLength(1);
  });

  it('only maps known server error paths onto fields', () => {
    expect(isProductFieldPath('tiers.2.bundlePrice')).toBe(true);
    expect(isProductFieldPath('brandId')).toBe(true);
    expect(isProductFieldPath('images.0')).toBe(true);
    expect(isProductFieldPath('tiers.0.id')).toBe(false);
    expect(isProductFieldPath('__proto__')).toBe(false);
  });
});
