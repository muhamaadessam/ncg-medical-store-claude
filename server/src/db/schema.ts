import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import {
  char,
  check,
  decimal,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

/** UUID primary key generated in the app (portable across MySQL 8 and MariaDB). */
const id = () =>
  char('id', { length: 36 })
    .primaryKey()
    .$defaultFn(() => randomUUID());

// `CURRENT_TIMESTAMP` (not `(now())`) keeps the DDL valid on MySQL 5.7, 8.x and MariaDB.
const createdAt = () =>
  timestamp('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`);

export const brands = mysqlTable('brands', {
  id: id(),
  name: varchar('name', { length: 120 }).notNull().unique('brands_name_unique'),
  createdAt: createdAt(),
});

export const categories = mysqlTable('categories', {
  id: id(),
  name: varchar('name', { length: 120 }).notNull().unique('categories_name_unique'),
  createdAt: createdAt(),
});

export const products = mysqlTable(
  'products',
  {
    id: id(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    brandId: char('brand_id', { length: 36 })
      .notNull()
      .references(() => brands.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    categoryId: char('category_id', { length: 36 })
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .onUpdateNow(),
  },
  (t) => [index('products_name_idx').on(t.name), index('products_created_at_idx').on(t.createdAt)],
);

export const productImages = mysqlTable('product_images', {
  id: id(),
  productId: char('product_id', { length: 36 })
    .notNull()
    .references(() => products.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  url: varchar('url', { length: 500 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
});

export const pricingTiers = mysqlTable(
  'pricing_tiers',
  {
    id: id(),
    productId: char('product_id', { length: 36 })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    label: varchar('label', { length: 60 }).notNull(),
    unitsPerBundle: int('units_per_bundle').notNull(),
    /** TOTAL price of the bundle in KWD (never per pack). Read as a string; convert with `toFils`. */
    bundlePrice: decimal('bundle_price', { precision: 10, scale: 3 }).notNull(),
    sortOrder: int('sort_order').notNull().default(0),
  },
  (t) => [
    uniqueIndex('pricing_tiers_product_units_unique').on(t.productId, t.unitsPerBundle),
    check('pricing_tiers_units_positive', sql`units_per_bundle > 0`),
    check('pricing_tiers_price_positive', sql`bundle_price > 0`),
  ],
);

// No drizzle `relations()` on purpose: the relational query API emits LATERAL joins, which
// MariaDB (typical on cPanel) does not support. Related rows are loaded with plain queries.

export type Brand = typeof brands.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
export type PricingTier = typeof pricingTiers.$inferSelect;
