import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { toFils } from '@ncg/shared';
import { asc, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDb, hasTestDb, truncateCatalog } from '../test/test-db';
import type { Database } from './client';
import { DB_ERRNO, dbErrno, isDbError } from './errors';
import { brands, categories, pricingTiers, productImages, products } from './schema';
import { seedDatabase } from './seed';
import { SEED_PRODUCTS } from './seed-data';

async function expectDbError(promise: Promise<unknown>, errno: number | readonly number[]) {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err, 'expected the query to fail').toBeDefined();
  expect(isDbError(err, errno), `unexpected errno ${dbErrno(err)}`).toBe(true);
}

/** Plain portable queries (no LATERAL), assembled in JS. */
async function loadCatalog(db: Database) {
  const rows = await db
    .select({ product: products, brand: brands, category: categories })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id));
  const images = await db.select().from(productImages).orderBy(asc(productImages.sortOrder));
  const tiers = await db.select().from(pricingTiers).orderBy(asc(pricingTiers.sortOrder));
  return rows.map(({ product, brand, category }) => ({
    ...product,
    brand,
    category,
    images: images.filter((i) => i.productId === product.id),
    tiers: tiers.filter((t) => t.productId === product.id),
  }));
}

describe.skipIf(!hasTestDb)('database schema (MySQL/MariaDB)', () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(() => {
    ({ db, close } = connectTestDb());
  });
  afterAll(() => close());
  beforeEach(() => truncateCatalog(db));

  async function createProduct() {
    const [brand] = await db.insert(brands).values({ name: 'Brand A' }).$returningId();
    const [category] = await db.insert(categories).values({ name: 'Category A' }).$returningId();
    const [product] = await db
      .insert(products)
      .values({ name: 'Test product', brandId: brand!.id, categoryId: category!.id })
      .$returningId();
    return { brandId: brand!.id, categoryId: category!.id, productId: product!.id };
  }

  it('creates InnoDB utf8mb4 tables', async () => {
    const [rows] = (await db.execute(sql`
      SELECT table_name AS name, engine AS engine, table_collation AS collation
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name <> '__drizzle_migrations'`)) as unknown as [
      { name: string; engine: string; collation: string }[],
    ];
    expect(rows.map((r) => r.name).sort()).toEqual([
      'brands',
      'categories',
      'pricing_tiers',
      'product_images',
      'products',
    ]);
    for (const row of rows) {
      expect(row.engine).toBe('InnoDB');
      expect(row.collation).toMatch(/^utf8mb4_/);
    }
  });

  it('stores and returns UTC timestamps whatever the server time zone is', async () => {
    // Every pooled connection runs in UTC (CI runs the database containers in UTC+5 to prove it).
    const sessions = await Promise.all(
      [1, 2, 3].map(() => db.execute(sql`SELECT @@session.time_zone AS tz`)),
    );
    for (const [rows] of sessions as unknown as [{ tz: string }[]][]) {
      expect(rows[0]!.tz).toBe('+00:00');
    }

    const before = Date.now();
    await db.insert(brands).values({ name: 'Clock check' });
    const [row] = await db.select().from(brands);
    // CURRENT_TIMESTAMP has second precision: allow a little slack, but never hours.
    expect(Math.abs(row!.createdAt.getTime() - before)).toBeLessThan(5_000);
  });

  it('stores names with full Unicode (utf8mb4)', async () => {
    await db.insert(brands).values({ name: 'صيدلية 💊' });
    const [row] = await db.select().from(brands);
    expect(row!.name).toBe('صيدلية 💊');
  });

  it('rejects duplicate brand and category names (case-insensitive)', async () => {
    await db.insert(brands).values({ name: 'MediCare' });
    await expectDbError(db.insert(brands).values({ name: 'medicare' }), DB_ERRNO.DUP_ENTRY);
    await db.insert(categories).values({ name: 'First Aid' });
    await expectDbError(db.insert(categories).values({ name: 'First Aid' }), DB_ERRNO.DUP_ENTRY);
  });

  it('returns DECIMAL(10,3) prices as exact strings', async () => {
    const { productId } = await createProduct();
    await db
      .insert(pricingTiers)
      .values({ productId, label: '4 Packs', unitsPerBundle: 4, bundlePrice: '19.500' });
    const [tier] = await db.select().from(pricingTiers);
    expect(tier!.bundlePrice).toBe('19.500');
    expect(toFils(tier!.bundlePrice)).toBe(19500);
  });

  it('enforces UNIQUE(product_id, units_per_bundle)', async () => {
    const { productId } = await createProduct();
    await db
      .insert(pricingTiers)
      .values({ productId, label: '4 Packs', unitsPerBundle: 4, bundlePrice: '19.500' });
    await expectDbError(
      db
        .insert(pricingTiers)
        .values({ productId, label: 'Another 4', unitsPerBundle: 4, bundlePrice: '18.000' }),
      DB_ERRNO.DUP_ENTRY,
    );
  });

  it('enforces CHECK units_per_bundle > 0 and bundle_price > 0', async () => {
    const { productId } = await createProduct();
    await expectDbError(
      db
        .insert(pricingTiers)
        .values({ productId, label: 'Zero', unitsPerBundle: 0, bundlePrice: '1.000' }),
      DB_ERRNO.CHECK_VIOLATION,
    );
    await expectDbError(
      db
        .insert(pricingTiers)
        .values({ productId, label: 'Free', unitsPerBundle: 1, bundlePrice: '0.000' }),
      DB_ERRNO.CHECK_VIOLATION,
    );
  });

  it('RESTRICTs deleting a brand or category that products use', async () => {
    const { brandId, categoryId } = await createProduct();
    await expectDbError(
      db.delete(brands).where(eq(brands.id, brandId)),
      DB_ERRNO.ROW_IS_REFERENCED,
    );
    await expectDbError(
      db.delete(categories).where(eq(categories.id, categoryId)),
      DB_ERRNO.ROW_IS_REFERENCED,
    );
  });

  it('CASCADEs product deletes to tiers and images', async () => {
    const { productId } = await createProduct();
    await db
      .insert(pricingTiers)
      .values({ productId, label: '1 Pack', unitsPerBundle: 1, bundlePrice: '1.000' });
    await db.insert(productImages).values({ productId, url: '/uploads/x.jpg' });
    await db.delete(products).where(eq(products.id, productId));
    expect(await db.select().from(pricingTiers)).toHaveLength(0);
    expect(await db.select().from(productImages)).toHaveLength(0);
  });

  describe('seed', () => {
    let uploadDir: string;
    beforeAll(() => {
      uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ncg-uploads-'));
    });
    afterAll(() => fs.rmSync(uploadDir, { recursive: true, force: true }));

    it('creates the brief catalog and is idempotent', async () => {
      const first = await seedDatabase(db, { uploadDir });
      expect(first).toEqual({ createdProducts: 4, skippedProducts: 0 });
      const second = await seedDatabase(db, { uploadDir });
      expect(second).toEqual({ createdProducts: 0, skippedProducts: 4 });

      expect(await db.select().from(brands)).toHaveLength(2);
      expect(await db.select().from(categories)).toHaveLength(2);

      const all = await loadCatalog(db);
      expect(all).toHaveLength(4);

      const byName = new Map(all.map((p) => [p.name, p]));
      const tierSummary = (name: string) =>
        byName
          .get(name)!
          .tiers.map((t) => [t.label, t.unitsPerBundle, toFils(t.bundlePrice)] as const);

      expect(tierSummary('Digital Thermometer')).toEqual([['1 Pack', 1, 3750]]);
      expect(tierSummary('Sterile Gauze Pads (10 pcs)')).toEqual([
        ['1 Pack', 1, 1250],
        ['4 Packs', 4, 4500],
      ]);
      expect(tierSummary('Vitamin D3 1000 IU (60 caps)')).toEqual([
        ['1 Pack', 1, 5500],
        ['4 Packs', 4, 19500],
        ['12 Packs', 12, 55000],
      ]);
      expect(tierSummary('Omega-3 Fish Oil (90 softgels)')).toEqual([
        ['1 Pack', 1, 6250],
        ['3 Packs', 3, 17000],
      ]);

      const vitD = byName.get('Vitamin D3 1000 IU (60 caps)')!;
      expect(vitD.brand.name).toBe('MediCare');
      expect(vitD.category.name).toBe('Vitamins & Supplements');
      expect(vitD.images.map((i) => i.url)).toEqual([
        '/uploads/seed-vitd3.jpg',
        '/uploads/seed-vitd3-caps.jpg',
      ]);

      // Every registered image exists in the upload folder.
      for (const product of all) {
        for (const image of product.images) {
          expect(fs.existsSync(path.join(uploadDir, path.basename(image.url)))).toBe(true);
        }
      }
    });

    it('--reset wipes catalog data and reseeds', async () => {
      await seedDatabase(db, { uploadDir });
      await db.insert(brands).values({ name: 'Extra brand' });
      const result = await seedDatabase(db, { uploadDir, reset: true });
      expect(result.createdProducts).toBe(SEED_PRODUCTS.length);
      expect((await db.select().from(brands)).map((b) => b.name).sort()).toEqual([
        'MediCare',
        'PharmaPlus',
      ]);
    });
  });
});
