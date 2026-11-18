import type { BrandDto, CategoryDto, ProductDto } from '@ncg/shared';

export const MEDICARE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const PHARMAPLUS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const VITAMINS = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const FIRST_AID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const base = {
  description: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const vitaminD: ProductDto = {
  ...base,
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Vitamin D3 1000 IU (60 caps)',
  brand: { id: MEDICARE, name: 'MediCare' },
  category: { id: VITAMINS, name: 'Vitamins & Supplements' },
  images: [{ id: 'img-1', url: '/uploads/seed-vitd3.jpg', sortOrder: 0 }],
  tiers: [
    { id: 'tier-1', label: '1 Pack', unitsPerBundle: 1, bundlePriceFils: 5500, sortOrder: 0 },
    { id: 'tier-4', label: '4 Packs', unitsPerBundle: 4, bundlePriceFils: 19500, sortOrder: 1 },
    { id: 'tier-12', label: '12 Packs', unitsPerBundle: 12, bundlePriceFils: 55000, sortOrder: 2 },
  ],
};

export const thermometer: ProductDto = {
  ...base,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Digital Thermometer',
  brand: { id: MEDICARE, name: 'MediCare' },
  category: { id: FIRST_AID, name: 'First Aid' },
  images: [],
  tiers: [
    { id: 'thermo-1', label: '1 Pack', unitsPerBundle: 1, bundlePriceFils: 3750, sortOrder: 0 },
  ],
};

export const brands: BrandDto[] = [
  { id: MEDICARE, name: 'MediCare', productCount: 2, createdAt: base.createdAt },
  { id: PHARMAPLUS, name: 'PharmaPlus', productCount: 0, createdAt: base.createdAt },
];

export const categories: CategoryDto[] = [
  { id: FIRST_AID, name: 'First Aid', productCount: 1, createdAt: base.createdAt },
  { id: VITAMINS, name: 'Vitamins & Supplements', productCount: 1, createdAt: base.createdAt },
];

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
