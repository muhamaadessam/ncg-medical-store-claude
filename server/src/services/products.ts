import { randomUUID } from 'node:crypto';
import type { ProductDto, ProductInput, TierInput } from '@ncg/shared';
import { eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { DB_ERRNO, isDbError } from '../db/errors';
import {
  brands,
  categories,
  pricingTiers,
  productImages,
  products,
  type PricingTier,
} from '../db/schema';
import { HttpError, notFound } from '../middleware/errors';
import { validationError } from '../middleware/validation';
import { getProduct } from './catalog';
import { removeOrphanUploads } from './uploads';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface TierPlan {
  /** Existing tier ids to delete (removed, or changed). */
  deleteIds: string[];
  /** Rows to insert (changed or new), with ids already decided. */
  insert: Array<TierInput & { id: string; sortOrder: number }>;
  /** Existing tiers kept exactly as they are. */
  keepIds: string[];
}

/**
 * Diff submitted tiers against the stored ones.
 * - unchanged (same id, label, units, price, position) → untouched
 * - removed or changed → deleted, then changed/new ones inserted
 * Deleting first means swapping units between tiers never trips UNIQUE(product_id, units).
 * A changed tier keeps its id when its bundle size (units) is unchanged, so carts holding it keep
 * the line and simply show the new label/price; a new bundle size is a new offer with a new id.
 */
export function planTierChanges(existing: PricingTier[], submitted: TierInput[]): TierPlan {
  const byId = new Map(existing.map((t) => [t.id, t]));
  const keepIds: string[] = [];
  const insert: TierPlan['insert'] = [];

  submitted.forEach((tier, sortOrder) => {
    const current = tier.id ? byId.get(tier.id) : undefined;
    const unchanged =
      current &&
      current.label === tier.label &&
      current.unitsPerBundle === tier.unitsPerBundle &&
      current.bundlePrice === tier.bundlePrice &&
      current.sortOrder === sortOrder;
    if (unchanged) {
      keepIds.push(current.id);
      return;
    }
    const keepIdentity = current && current.unitsPerBundle === tier.unitsPerBundle;
    insert.push({ ...tier, id: keepIdentity ? current.id : randomUUID(), sortOrder });
  });

  const keep = new Set(keepIds);
  const deleteIds = existing.filter((t) => !keep.has(t.id)).map((t) => t.id);
  return { deleteIds, insert, keepIds };
}

async function assertReferencesExist(tx: Tx, input: ProductInput) {
  const [[brand], [category]] = await Promise.all([
    tx.select({ id: brands.id }).from(brands).where(eq(brands.id, input.brandId)),
    tx.select({ id: categories.id }).from(categories).where(eq(categories.id, input.categoryId)),
  ]);
  const issues = [];
  if (!brand) issues.push({ path: 'brandId', message: 'This brand no longer exists' });
  if (!category) issues.push({ path: 'categoryId', message: 'This category no longer exists' });
  if (issues.length) throw validationError(issues);
}

function mapWriteError(err: unknown): never {
  if (isDbError(err, DB_ERRNO.DUP_ENTRY)) {
    throw new HttpError(
      409,
      'DUPLICATE_TIER_UNITS',
      'Two tiers cannot have the same units per bundle.',
    );
  }
  if (isDbError(err, DB_ERRNO.NO_REFERENCED_ROW)) {
    throw validationError([{ path: 'brandId', message: 'Brand or category no longer exists' }]);
  }
  if (isDbError(err, DB_ERRNO.CHECK_VIOLATION)) {
    throw validationError([{ path: 'tiers', message: 'Units and prices must be greater than 0' }]);
  }
  throw err;
}

async function writeImages(tx: Tx, productId: string, urls: string[]) {
  await tx.delete(productImages).where(eq(productImages.productId, productId));
  if (urls.length) {
    await tx
      .insert(productImages)
      .values(urls.map((url, sortOrder) => ({ productId, url, sortOrder })));
  }
}

export async function createProduct(db: Database, input: ProductInput): Promise<ProductDto> {
  const id = randomUUID();
  try {
    await db.transaction(async (tx) => {
      await assertReferencesExist(tx, input);
      await tx.insert(products).values({
        id,
        name: input.name,
        description: input.description,
        brandId: input.brandId,
        categoryId: input.categoryId,
      });
      await writeImages(tx, id, input.images);
      await tx.insert(pricingTiers).values(
        input.tiers.map((tier, sortOrder) => ({
          productId: id,
          label: tier.label,
          unitsPerBundle: tier.unitsPerBundle,
          bundlePrice: tier.bundlePrice,
          sortOrder,
        })),
      );
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    mapWriteError(err);
  }
  return (await getProduct(db, id))!;
}

export async function updateProduct(
  db: Database,
  id: string,
  input: ProductInput,
  uploadDir?: string,
): Promise<ProductDto> {
  let removedImageUrls: string[] = [];
  try {
    await db.transaction(async (tx) => {
      // Lock the product row so concurrent edits of the same product serialise.
      const [current] = await tx.select().from(products).where(eq(products.id, id)).for('update');
      if (!current) throw notFound('Product not found');
      await assertReferencesExist(tx, input);

      await tx
        .update(products)
        .set({
          name: input.name,
          description: input.description,
          brandId: input.brandId,
          categoryId: input.categoryId,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(products.id, id));

      const oldImages = await tx
        .select()
        .from(productImages)
        .where(eq(productImages.productId, id));
      removedImageUrls = oldImages.map((i) => i.url).filter((url) => !input.images.includes(url));
      await writeImages(tx, id, input.images);

      const existingTiers = await tx
        .select()
        .from(pricingTiers)
        .where(eq(pricingTiers.productId, id));
      const plan = planTierChanges(existingTiers, input.tiers);
      if (plan.deleteIds.length) {
        await tx.delete(pricingTiers).where(inArray(pricingTiers.id, plan.deleteIds));
      }
      if (plan.insert.length) {
        await tx.insert(pricingTiers).values(
          plan.insert.map((tier) => ({
            id: tier.id,
            productId: id,
            label: tier.label,
            unitsPerBundle: tier.unitsPerBundle,
            bundlePrice: tier.bundlePrice,
            sortOrder: tier.sortOrder,
          })),
        );
      }
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    mapWriteError(err);
  }
  if (uploadDir) await removeOrphanUploads(db, uploadDir, removedImageUrls);
  return (await getProduct(db, id))!;
}

export async function deleteProduct(db: Database, id: string, uploadDir?: string): Promise<void> {
  const images = await db
    .select({ url: productImages.url })
    .from(productImages)
    .where(eq(productImages.productId, id));
  const result = await db.delete(products).where(eq(products.id, id)); // tiers + images cascade
  if (result[0].affectedRows === 0) throw notFound('Product not found');
  if (uploadDir) {
    await removeOrphanUploads(
      db,
      uploadDir,
      images.map((i) => i.url),
    );
  }
}
