import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProduct, deleteProduct } from '../services/products';
import { connectTestDb, hasTestDb, truncateCatalog } from '../test/test-db';
import type { Database } from './client';
import { repairSchema } from './repair';
import { brands, categories, pricingTiers, productImages, products } from './schema';

const TABLES = ['brands', 'categories', 'products', 'product_images', 'pricing_tiers'];
const FKS: [string, string][] = [
  ['pricing_tiers', 'pricing_tiers_product_id_products_id_fk'],
  ['product_images', 'product_images_product_id_products_id_fk'],
  ['products', 'products_brand_id_brands_id_fk'],
  ['products', 'products_category_id_categories_id_fk'],
];

/** Recreate production's state: MyISAM tables, i.e. no foreign keys and no transactions. */
async function degradeToMyIsam(db: Database) {
  for (const [table, fk] of FKS) {
    await db.execute(sql.raw(`ALTER TABLE \`${table}\` DROP FOREIGN KEY IF EXISTS \`${fk}\``));
  }
  for (const table of TABLES) await db.execute(sql.raw(`ALTER TABLE \`${table}\` ENGINE=MyISAM`));
}

async function engines(db: Database) {
  const [rows] = (await db.execute(
    sql`SELECT table_name AS name, engine AS engine FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name IN ${TABLES}`,
  )) as unknown as [{ name: string; engine: string }[]];
  return Object.fromEntries(rows.map((r) => [r.name, r.engine]));
}

async function foreignKeys(db: Database) {
  const [rows] = (await db.execute(
    sql`SELECT constraint_name AS name FROM information_schema.referential_constraints
        WHERE constraint_schema = DATABASE()`,
  )) as unknown as [{ name: string }[]];
  return rows.map((r) => r.name).sort();
}

describe.skipIf(!hasTestDb)('schema repair (tables created on a MyISAM-default server)', () => {
  let db: Database;
  let close: () => Promise<void>;
  let uploadDir: string;

  beforeAll(() => {
    ({ db, close } = connectTestDb());
  });
  afterAll(async () => {
    await repairSchema(db); // leave InnoDB + foreign keys for the other test files
    await truncateCatalog(db);
    await close();
  });
  beforeEach(async () => {
    await repairSchema(db);
    await truncateCatalog(db);
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ncg-repair-'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  async function productWithImage(file: string) {
    const [brand] = await db.insert(brands).values({ name: 'MediCare' }).$returningId();
    const [category] = await db.insert(categories).values({ name: 'First Aid' }).$returningId();
    fs.writeFileSync(path.join(uploadDir, file), 'png');
    return createProduct(db, {
      name: 'QA Log Check Product',
      description: null,
      brandId: brand!.id,
      categoryId: category!.id,
      images: [`/uploads/${file}`],
      tiers: [{ label: '1 Pack', unitsPerBundle: 1, bundlePrice: '1.000' }],
    });
  }

  it('reproduces production: on MyISAM, a cascade-only delete leaves the image row behind', async () => {
    await degradeToMyIsam(db);
    expect(Object.values(await engines(db))).toEqual(TABLES.map(() => 'MyISAM'));
    expect(await foreignKeys(db)).toEqual([]);

    const product = await productWithImage('kept.png');
    await db.delete(products).where(sql`id = ${product.id}`); // what the old deleteProduct relied on
    expect(await db.select().from(productImages)).toHaveLength(1); // the row that kept the file
  });

  it('deleteProduct removes the rows and the file even without foreign keys', async () => {
    await degradeToMyIsam(db);
    const product = await productWithImage('qa.png');

    await deleteProduct(db, product.id, uploadDir);

    expect(fs.existsSync(path.join(uploadDir, 'qa.png'))).toBe(false);
    expect(await db.select().from(productImages)).toHaveLength(0);
    expect(await db.select().from(pricingTiers)).toHaveLength(0);
  });

  it('db:migrate repair converts to InnoDB, cleans leftovers, deletes their files, restores FKs', async () => {
    await degradeToMyIsam(db);
    const product = await productWithImage('leftover.png');
    await db.delete(products).where(sql`id = ${product.id}`); // leftover rows, like production

    const log: string[] = [];
    const report = await repairSchema(db, { uploadDir, log: (m) => log.push(m) });

    expect(report.convertedTables.sort()).toEqual([...TABLES].sort());
    expect(report.orphanImageRows).toBe(1);
    expect(report.orphanTierRows).toBe(1);
    expect(report.removedFiles).toEqual(['/uploads/leftover.png']);
    expect(report.addedForeignKeys.sort()).toEqual(FKS.map(([, fk]) => fk).sort());
    expect(fs.existsSync(path.join(uploadDir, 'leftover.png'))).toBe(false);
    expect(Object.values(await engines(db))).toEqual(TABLES.map(() => 'InnoDB'));
    expect(await foreignKeys(db)).toEqual(FKS.map(([, fk]) => fk).sort());
    expect(log.length).toBeGreaterThan(0);

    // Idempotent: a healthy database is left alone.
    expect(await repairSchema(db, { uploadDir })).toEqual({
      convertedTables: [],
      orphanImageRows: 0,
      orphanTierRows: 0,
      removedFiles: [],
      addedForeignKeys: [],
    });
  });

  it('keeps files that a remaining product still uses, and says so', async () => {
    const product = await productWithImage('shared.png');
    await db.insert(productImages).values({ productId: product.id, url: '/uploads/shared.png' });
    const { removeOrphanUploads } = await import('../services/uploads');
    const result = await removeOrphanUploads(db, uploadDir, ['/uploads/shared.png']);
    expect(result).toEqual({ deleted: [], failed: [] });
    expect(fs.existsSync(path.join(uploadDir, 'shared.png'))).toBe(true);
    expect(console.error).toHaveBeenCalledWith(
      '[uploads] kept /uploads/shared.png: another product still uses it',
    );
  });
});
