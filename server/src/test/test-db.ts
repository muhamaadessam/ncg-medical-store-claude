import { sql } from 'drizzle-orm';
import { config } from '../config';
import { createDb, createPool, type Database } from '../db/client';
import { brands, categories, pricingTiers, productImages, products } from '../db/schema';

/** Test database URL, or undefined (DB tests are then skipped). */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || undefined;
export const hasTestDb = Boolean(TEST_DATABASE_URL);

/** Refuse to wipe anything that does not look like a throwaway test database. */
export function assertTestDatabase(url: string): void {
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `TEST_DATABASE_URL must point to a database ending in "_test" (got "${dbName}")`,
    );
  }
  if (url === config.databaseUrl) {
    throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL');
  }
}

export function connectTestDb(): { db: Database; close: () => Promise<void> } {
  const pool = createPool(TEST_DATABASE_URL!);
  return { db: createDb(pool), close: () => pool.end() };
}

/** Delete all catalog rows (children first). */
export async function truncateCatalog(db: Database): Promise<void> {
  await db.delete(pricingTiers);
  await db.delete(productImages);
  await db.delete(products);
  await db.delete(brands);
  await db.delete(categories);
}

/** Drop every table in the current database (used before re-running migrations). */
export async function dropAllTables(db: Database): Promise<void> {
  const [rows] = (await db.execute(
    sql`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()`,
  )) as unknown as [{ name: string }[]];
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  for (const { name } of rows) {
    await db.execute(sql.raw(`DROP TABLE IF EXISTS \`${name.replace(/`/g, '')}\``));
  }
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
