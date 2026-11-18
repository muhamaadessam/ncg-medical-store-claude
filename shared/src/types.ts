/** API response shapes (JSON). Money is always integer fils. */

export interface NamedRef {
  id: string;
  name: string;
}

/** Brand or category with the number of products that use it. */
export interface TaxonomyDto extends NamedRef {
  productCount: number;
  createdAt: string;
}
export type BrandDto = TaxonomyDto;
export type CategoryDto = TaxonomyDto;

export interface ProductImageDto {
  id: string;
  url: string;
  sortOrder: number;
}

export interface PricingTierDto {
  id: string;
  label: string;
  unitsPerBundle: number;
  /** TOTAL bundle price in integer fils (1 KWD = 1000 fils). */
  bundlePriceFils: number;
  sortOrder: number;
}

export interface ProductDto {
  id: string;
  name: string;
  description: string | null;
  brand: NamedRef;
  category: NamedRef;
  /** Ordered by sortOrder. */
  images: ProductImageDto[];
  /** Ordered by sortOrder; always at least one. */
  tiers: PricingTierDto[];
  createdAt: string;
  updatedAt: string;
}

export interface UploadResponse {
  url: string;
}

export interface ValidationIssue {
  /** Dot path into the request, e.g. "tiers.1.unitsPerBundle" ("" for the root). */
  path: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
