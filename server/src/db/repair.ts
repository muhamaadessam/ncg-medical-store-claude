import { sql } from 'drizzle-orm';
import { removeOrphanUploads } from '../services/uploads';
import type { Database } from './client';

/**
 * Makes an existing database match what the migrations intend, even if it was created on a
 * server whose default storage engine is MyISAM (seen on shared hosting).
 *
 * MyISAM silently ignores FOREIGN KEY clauses and transactions, so products could be deleted while
 * their image/tier rows stayed behind: those leftover rows made deleted images look "still in
 * use", and the files were never removed. This runs after every `db:migrate` and is idempotent:
 * when everything is already InnoDB with its foreign keys, it changes nothing.
 */

/** Parents before children, so foreign keys can be added in this order. */
const TABLES = ['brands', 'categories', 'products', 'product_images', 'pricing_tiers'] as const;

const FOREIGN_KEYS = [
  {
    name: 'products_brand_id_brands_id_fk',
    sql: 'ALTER TABLE `products` ADD CONSTRAINT `products_brand_id_brands_id_fk` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  },
  {
    name: 'products_category_id_categories_id_fk',
    sql: 'ALTER TABLE `products` ADD CONSTRAINT `products_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  },
  {
    name: 'product_images_product_id_products_id_fk',
    sql: 'ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  },
  {
    name: 'pricing_tiers_product_id_products_id_fk',
    sql: 'ALTER TABLE `pricing_tiers` ADD CONSTRAINT `pricing_tiers_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  },
] as const;

export interface RepairReport {
  convertedTables: string[];
  orphanImageRows: number;
  orphanTierRows: number;
  removedFiles: string[];
  addedForeignKeys: string[];
}

async function rows<T>(db: Database, query: ReturnType<typeof sql>): Promise<T[]> {
  const [result] = (await db.execute(query)) as unknown as [T[]];
  return result;
}

export async function repairSchema(
  db: Database,
  options: { uploadDir?: string; log?: (message: string) => void } = {},
): Promise<RepairReport> {
  const log = options.log ?? (() => {});
  const report: RepairReport = {
    convertedTables: [],
    orphanImageRows: 0,
    orphanTierRows: 0,
    removedFiles: [],
    addedForeignKeys: [],
  };

  // 1. Storage engine: InnoDB everywhere (foreign keys, transactions, row locks).
  const engines = await rows<{ name: string; engine: string }>(
    db,
    sql`SELECT table_name AS name, engine AS engine FROM information_schema.tables
        WHERE table_schema = DATABASE()`,
  );
  const engineOf = new Map(engines.map((t) => [t.name, t.engine]));
  for (const table of TABLES) {
    const engine = engineOf.get(table);
    if (engine && engine.toLowerCase() !== 'innodb') {
      await db.execute(sql.raw(`ALTER TABLE \`${table}\` ENGINE=InnoDB`));
      report.convertedTables.push(table);
      log(`converted ${table} from ${engine} to InnoDB`);
    }
  }

  // 2. Rows left behind by deletes that ran without ON DELETE CASCADE.
  const orphanImages = await rows<{ url: string }>(
    db,
    sql`SELECT url FROM product_images WHERE product_id NOT IN (SELECT id FROM products)`,
  );
  if (orphanImages.length) {
    await db.execute(
      sql`DELETE FROM product_images WHERE product_id NOT IN (SELECT id FROM products)`,
    );
    report.orphanImageRows = orphanImages.length;
    log(`removed ${orphanImages.length} image row(s) of deleted products`);
  }
  const [{ count: orphanTiers } = { count: 0 }] = await rows<{ count: number }>(
    db,
    sql`SELECT COUNT(*) AS count FROM pricing_tiers WHERE product_id NOT IN (SELECT id FROM products)`,
  );
  if (Number(orphanTiers) > 0) {
    await db.execute(
      sql`DELETE FROM pricing_tiers WHERE product_id NOT IN (SELECT id FROM products)`,
    );
    report.orphanTierRows = Number(orphanTiers);
    log(`removed ${orphanTiers} pricing tier row(s) of deleted products`);
  }
  // ...and the image files those rows were keeping alive.
  if (options.uploadDir && orphanImages.length) {
    const { deleted } = await removeOrphanUploads(
      db,
      options.uploadDir,
      orphanImages.map((i) => i.url),
    );
    report.removedFiles = deleted;
    if (deleted.length) log(`deleted ${deleted.length} unused image file(s)`);
  }

  // 3. Foreign keys that MyISAM dropped silently.
  const existing = new Set(
    (
      await rows<{ name: string }>(
        db,
        sql`SELECT constraint_name AS name FROM information_schema.referential_constraints
            WHERE constraint_schema = DATABASE()`,
      )
    ).map((r) => r.name),
  );
  for (const fk of FOREIGN_KEYS) {
    if (existing.has(fk.name)) continue;
    await db.execute(sql.raw(fk.sql));
    report.addedForeignKeys.push(fk.name);
    log(`added foreign key ${fk.name}`);
  }

  return report;
}
