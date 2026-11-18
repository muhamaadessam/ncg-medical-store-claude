import type { ProductDto, ProductListQuery } from '@ncg/shared';
import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';
import type { Database } from '../db/client';
import { brands, categories, pricingTiers, productImages, products } from '../db/schema';
import { toImageDto, toIso, toTierDto } from './mappers';

/** `Map.groupBy` is Node 21+; the app supports Node 20. */
function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = map.get(k);
    if (group) group.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/**
 * Read side of the catalog. Uses plain joins + `IN (...)` queries assembled in JS
 * (no LATERAL joins, which MariaDB does not support).
 */
async function loadProducts(db: Database, where?: SQL): Promise<ProductDto[]> {
  const rows = await db
    .select({
      product: products,
      brand: { id: brands.id, name: brands.name },
      category: { id: categories.id, name: categories.name },
    })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(where)
    .orderBy(asc(products.name), asc(products.id));

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.product.id);

  const [images, tiers] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, ids))
      .orderBy(asc(productImages.sortOrder), asc(productImages.id)),
    db
      .select()
      .from(pricingTiers)
      .where(inArray(pricingTiers.productId, ids))
      .orderBy(asc(pricingTiers.sortOrder), asc(pricingTiers.unitsPerBundle)),
  ]);

  const imagesByProduct = groupBy(images, (i) => i.productId);
  const tiersByProduct = groupBy(tiers, (t) => t.productId);

  return rows.map(({ product, brand, category }) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    brand,
    category,
    images: (imagesByProduct.get(product.id) ?? []).map(toImageDto),
    tiers: (tiersByProduct.get(product.id) ?? []).map(toTierDto),
    createdAt: toIso(product.createdAt),
    updatedAt: toIso(product.updatedAt),
  }));
}

export function listProducts(db: Database, filters: ProductListQuery = {}): Promise<ProductDto[]> {
  const conditions: SQL[] = [];
  if (filters.brandId) conditions.push(eq(products.brandId, filters.brandId));
  if (filters.categoryId) conditions.push(eq(products.categoryId, filters.categoryId));
  return loadProducts(db, conditions.length ? and(...conditions) : undefined);
}

export async function getProduct(db: Database, id: string): Promise<ProductDto | undefined> {
  const [product] = await loadProducts(db, eq(products.id, id));
  return product;
}
