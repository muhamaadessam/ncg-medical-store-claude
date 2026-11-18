import type { ProductDto, ProductFormValues } from '@ncg/shared';
import type { Database } from '../db/client';
import { brands, categories } from '../db/schema';

export async function createBrandAndCategory(db: Database, suffix = '') {
  const [brand] = await db
    .insert(brands)
    .values({ name: `MediCare${suffix}` })
    .$returningId();
  const [category] = await db
    .insert(categories)
    .values({ name: `Vitamins${suffix}` })
    .$returningId();
  return { brandId: brand!.id, categoryId: category!.id };
}

export function vitaminD(brandId: string, categoryId: string) {
  return {
    name: 'Vitamin D3 1000 IU (60 caps)',
    description: 'Daily vitamin D3.',
    brandId,
    categoryId,
    images: [] as string[],
    tiers: [
      { label: '1 Pack', unitsPerBundle: 1, bundlePrice: '5.500' },
      { label: '4 Packs', unitsPerBundle: 4, bundlePrice: '19.500' },
      { label: '12 Packs', unitsPerBundle: 12, bundlePrice: '55.000' },
    ],
  };
}

/** Turn a product response back into a PUT body (prices in KWD strings). */
export function toInput(product: ProductDto): ProductFormValues & { tiers: { id?: string }[] } {
  return {
    name: product.name,
    description: product.description,
    brandId: product.brand.id,
    categoryId: product.category.id,
    images: product.images.map((i) => i.url),
    tiers: product.tiers.map((t) => ({
      id: t.id,
      label: t.label,
      unitsPerBundle: t.unitsPerBundle,
      bundlePrice: (t.bundlePriceFils / 1000).toString(),
    })),
  };
}

/** Smallest valid PNG (1×1). */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
