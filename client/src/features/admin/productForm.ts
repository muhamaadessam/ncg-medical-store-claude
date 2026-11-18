import {
  filsToKwdString,
  formatKWD,
  perPackFils,
  priceKwdSchema,
  toFils,
  type ProductDto,
  type ProductFormValues,
} from '@ncg/shared';

export function toFormValues(product?: ProductDto): ProductFormValues {
  if (!product) {
    return {
      name: '',
      description: '',
      brandId: '',
      categoryId: '',
      images: [],
      tiers: [{ label: '1 Pack', unitsPerBundle: 1, bundlePrice: '' }],
    };
  }
  return {
    name: product.name,
    description: product.description ?? '',
    brandId: product.brand.id,
    categoryId: product.category.id,
    images: product.images.map((i) => i.url),
    tiers: product.tiers.map((t) => ({
      id: t.id,
      label: t.label,
      unitsPerBundle: t.unitsPerBundle,
      bundlePrice: filsToKwdString(t.bundlePriceFils),
    })),
  };
}

const KNOWN_PATHS =
  /^(name|description|brandId|categoryId|images(\.\d+)?|tiers(\.\d+\.(label|unitsPerBundle|bundlePrice))?)$/;
export const isProductFieldPath = (path: string) => KNOWN_PATHS.test(path);

/** "4.875 KWD per pack" from what is typed so far (integer fils), or a prompt. */
export function perPackHint(price: unknown, units: unknown): string {
  const parsed = priceKwdSchema.safeParse(price);
  if (!parsed.success || !Number.isInteger(units) || (units as number) < 1) {
    return 'Enter units and price to see the per-pack price';
  }
  const fils = toFils(parsed.data);
  if (units === 1) return `${formatKWD(fils)} for 1 pack`;
  return `${formatKWD(perPackFils({ bundlePriceFils: fils, unitsPerBundle: units as number }))} per pack`;
}
