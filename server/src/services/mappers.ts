import { toFils, type PricingTierDto, type ProductImageDto } from '@ncg/shared';
import type { PricingTier, ProductImage } from '../db/schema';

export const toIso = (date: Date) => date.toISOString();

export function toTierDto(tier: PricingTier): PricingTierDto {
  return {
    id: tier.id,
    label: tier.label,
    unitsPerBundle: tier.unitsPerBundle,
    bundlePriceFils: toFils(tier.bundlePrice),
    sortOrder: tier.sortOrder,
  };
}

export function toImageDto(image: ProductImage): ProductImageDto {
  return { id: image.id, url: image.url, sortOrder: image.sortOrder };
}
