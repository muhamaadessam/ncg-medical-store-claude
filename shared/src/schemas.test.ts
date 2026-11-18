import { describe, expect, it } from 'vitest';
import { isUuid } from './ids';
import { brandInputSchema, idSchema, priceKwdSchema, productInputSchema } from './schemas';

const BRAND = '0b9a1b5e-6f8e-4d55-9f3a-0d3a9b5f0c11';
const CATEGORY = '4c6f9d3e-2a1b-4c8d-9e7f-1a2b3c4d5e6f';

const validProduct = {
  name: 'Vitamin D3',
  description: '  Sunshine vitamin  ',
  brandId: BRAND,
  categoryId: CATEGORY,
  images: ['/uploads/abc.jpg'],
  tiers: [
    { label: '1 Pack', unitsPerBundle: 1, bundlePrice: '5.5' },
    { label: '4 Packs', unitsPerBundle: 4, bundlePrice: 19.5 },
  ],
};

function issues(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((i) => i.path.join('.')) ?? [];
}

describe('priceKwdSchema', () => {
  it('normalises valid prices to 3-decimal strings', () => {
    expect(priceKwdSchema.parse('19.5')).toBe('19.500');
    expect(priceKwdSchema.parse('19.500')).toBe('19.500');
    expect(priceKwdSchema.parse(19.5)).toBe('19.500');
    expect(priceKwdSchema.parse(' 55 ')).toBe('55.000');
    expect(priceKwdSchema.parse('0.001')).toBe('0.001');
    expect(priceKwdSchema.parse('9999999.999')).toBe('9999999.999');
  });

  it.each([
    ['0', 'greater than 0'],
    ['0.000', 'greater than 0'],
    ['-1', 'valid price'],
    ['1.2345', 'at most 3 decimals'],
    ['abc', 'valid price'],
    ['1e3', 'valid price'],
    ['', 'required'],
    ['10000000', 'too large'],
  ])('rejects %j (%s)', (input, message) => {
    const result = priceKwdSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain(message);
  });

  it('rejects float noise from number input', () => {
    expect(priceKwdSchema.safeParse(0.1 + 0.2).success).toBe(false);
    expect(priceKwdSchema.safeParse(Number.NaN).success).toBe(false);
  });
});

describe('brandInputSchema', () => {
  it('trims and requires a name', () => {
    expect(brandInputSchema.parse({ name: '  MediCare ' })).toEqual({ name: 'MediCare' });
    expect(brandInputSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(brandInputSchema.safeParse({}).success).toBe(false);
    expect(brandInputSchema.safeParse({ name: 'x'.repeat(121) }).success).toBe(false);
  });
});

describe('productInputSchema', () => {
  it('parses a valid product', () => {
    const parsed = productInputSchema.parse(validProduct);
    expect(parsed.description).toBe('Sunshine vitamin');
    expect(parsed.tiers.map((t) => t.bundlePrice)).toEqual(['5.500', '19.500']);
  });

  it('defaults images and nulls empty descriptions', () => {
    const { images: _images, ...rest } = validProduct;
    const parsed = productInputSchema.parse({ ...rest, description: '' });
    expect(parsed.images).toEqual([]);
    expect(parsed.description).toBeNull();
  });

  it('requires at least one tier', () => {
    const result = productInputSchema.safeParse({ ...validProduct, tiers: [] });
    expect(issues(result)).toEqual(['tiers']);
  });

  it('allows many tiers (no hardcoded maximum)', () => {
    const tiers = Array.from({ length: 25 }, (_, i) => ({
      label: `${i + 1} Packs`,
      unitsPerBundle: i + 1,
      bundlePrice: `${i + 1}.000`,
    }));
    expect(productInputSchema.safeParse({ ...validProduct, tiers }).success).toBe(true);
  });

  it('flags duplicate units on the duplicate tier', () => {
    const result = productInputSchema.safeParse({
      ...validProduct,
      tiers: [...validProduct.tiers, { label: 'Again', unitsPerBundle: 4, bundlePrice: '18' }],
    });
    expect(issues(result)).toEqual(['tiers.2.unitsPerBundle']);
  });

  it('reports duplicate units together with other tier errors', () => {
    const result = productInputSchema.safeParse({
      ...validProduct,
      tiers: [
        { label: 'A', unitsPerBundle: 1, bundlePrice: '1.2345' },
        { label: 'B', unitsPerBundle: 1, bundlePrice: '2' },
        { label: 'C', unitsPerBundle: Number.NaN, bundlePrice: '3' },
        { label: 'D', unitsPerBundle: Number.NaN, bundlePrice: '4' },
      ],
    });
    expect(issues(result).sort()).toEqual([
      'tiers.0.bundlePrice',
      'tiers.1.unitsPerBundle',
      'tiers.2.unitsPerBundle',
      'tiers.3.unitsPerBundle',
    ]);
  });

  it('validates tier fields', () => {
    const result = productInputSchema.safeParse({
      ...validProduct,
      tiers: [{ label: '', unitsPerBundle: 1.5, bundlePrice: '0' }],
    });
    expect(issues(result).sort()).toEqual([
      'tiers.0.bundlePrice',
      'tiers.0.label',
      'tiers.0.unitsPerBundle',
    ]);
  });

  it('requires name, brand and category', () => {
    const result = productInputSchema.safeParse({
      ...validProduct,
      name: '',
      brandId: '',
      categoryId: 'nope',
    });
    expect(issues(result).sort()).toEqual(['brandId', 'categoryId', 'name']);
  });

  it('only accepts uploaded image paths', () => {
    for (const url of ['https://evil.example/x.jpg', '/uploads/../.env', 'javascript:alert(1)']) {
      expect(productInputSchema.safeParse({ ...validProduct, images: [url] }).success).toBe(false);
    }
  });
});

describe('isUuid', () => {
  it('agrees with the zod uuid schema', () => {
    for (const value of [
      BRAND,
      CATEGORY,
      'not-a-uuid',
      '',
      '00000000-0000-0000-0000-000000000000',
      BRAND.toUpperCase(),
    ]) {
      expect(isUuid(value)).toBe(idSchema.safeParse(value).success);
    }
    expect(isUuid(42)).toBe(false);
  });
});
