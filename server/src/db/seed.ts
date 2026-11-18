import fs from 'node:fs/promises';
import path from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import { config } from '../config';
import { createDb, createPool, type Database } from './client';
import { brands, categories, pricingTiers, productImages, products } from './schema';
import { SEED_BRANDS, SEED_CATEGORIES, SEED_PRODUCTS } from './seed-data';

/** `server/seed-images`, from both `server/src/db` and `server/dist/db`. */
export const SEED_IMAGES_DIR = path.resolve(__dirname, '../../seed-images');

export interface SeedOptions {
  /** Delete ALL catalog data first (products, tiers, images, brands, categories). */
  reset?: boolean;
  uploadDir?: string;
  log?: (message: string) => void;
}

export interface SeedResult {
  createdProducts: number;
  skippedProducts: number;
}

/** Find-or-create rows by unique `name`; returns name → id. */
async function ensureNamed(
  db: Database,
  table: typeof brands | typeof categories,
  names: readonly string[],
): Promise<Map<string, string>> {
  const existing = await db
    .select()
    .from(table)
    .where(inArray(table.name, [...names]));
  const ids = new Map(existing.map((row) => [row.name, row.id]));
  for (const name of names) {
    if (ids.has(name)) continue;
    const [created] = await db.insert(table).values({ name }).$returningId();
    ids.set(name, created!.id);
  }
  return ids;
}

/**
 * Idempotent: brands/categories are matched by name, products by name. Existing products are
 * left untouched (so admin edits survive a re-seed); missing ones are created in a transaction.
 */
export async function seedDatabase(db: Database, options: SeedOptions = {}): Promise<SeedResult> {
  const { reset = false, uploadDir = config.uploadDir, log = () => {} } = options;

  if (reset) {
    await db.transaction(async (tx) => {
      await tx.delete(products); // tiers + images cascade
      await tx.delete(brands);
      await tx.delete(categories);
    });
    log('catalog data cleared');
  }

  // Copy images to the upload folder so they are served like admin uploads.
  await fs.mkdir(uploadDir, { recursive: true });
  const imageFiles = new Set(SEED_PRODUCTS.flatMap((p) => p.images));
  for (const file of imageFiles) {
    await fs.copyFile(path.join(SEED_IMAGES_DIR, file), path.join(uploadDir, `seed-${file}`));
  }

  const brandIds = await ensureNamed(db, brands, SEED_BRANDS);
  const categoryIds = await ensureNamed(db, categories, SEED_CATEGORIES);

  const result: SeedResult = { createdProducts: 0, skippedProducts: 0 };
  for (const seed of SEED_PRODUCTS) {
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.name, seed.name))
      .limit(1);
    if (existing) {
      result.skippedProducts += 1;
      continue;
    }

    await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({
          name: seed.name,
          description: seed.description,
          brandId: brandIds.get(seed.brand)!,
          categoryId: categoryIds.get(seed.category)!,
        })
        .$returningId();
      const productId = product!.id;
      await tx.insert(productImages).values(
        seed.images.map((file, sortOrder) => ({
          productId,
          url: `/uploads/seed-${file}`,
          sortOrder,
        })),
      );
      await tx
        .insert(pricingTiers)
        .values(seed.tiers.map((tier, sortOrder) => ({ ...tier, productId, sortOrder })));
    });
    result.createdProducts += 1;
    log(`created "${seed.name}" (${seed.tiers.length} tier(s))`);
  }
  return result;
}

if (require.main === module) {
  const reset = process.argv.includes('--reset');
  const pool = createPool(config.databaseUrl, { connectionLimit: 1 });
  seedDatabase(createDb(pool), { reset, log: (m) => console.log(`[seed] ${m}`) })
    .then(({ createdProducts, skippedProducts }) => {
      console.log(`[seed] done: ${createdProducts} created, ${skippedProducts} already present`);
    })
    .catch((err: unknown) => {
      console.error('[seed] failed:', err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
