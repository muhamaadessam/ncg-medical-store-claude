import type { TaxonomyDto } from '@ncg/shared';
import { asc, count, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { DB_ERRNO, isDbError } from '../db/errors';
import { brands, categories, products } from '../db/schema';
import { HttpError, notFound } from '../middleware/errors';
import { toIso } from './mappers';

/** Brands and categories have the same shape and rules; one service serves both. */
export type TaxonomyKind = 'brand' | 'category';

const TABLES = {
  brand: { table: brands, fk: products.brandId, label: 'brand', Label: 'Brand' },
  category: { table: categories, fk: products.categoryId, label: 'category', Label: 'Category' },
} as const;

function duplicateName(kind: TaxonomyKind, name: string) {
  return new HttpError(
    409,
    'DUPLICATE_NAME',
    `A ${TABLES[kind].label} named "${name}" already exists.`,
    [{ path: 'name', message: `A ${TABLES[kind].label} with this name already exists` }],
  );
}

function inUse(kind: TaxonomyKind, productCount: number) {
  const { label } = TABLES[kind];
  const subject = productCount === 1 ? '1 product uses' : `${productCount} products use`;
  return new HttpError(
    409,
    'IN_USE',
    `Cannot delete: ${subject} this ${label}. Reassign them first.`,
    { productCount },
  );
}

async function findOne(db: Database, kind: TaxonomyKind, id: string): Promise<TaxonomyDto> {
  const { table, fk } = TABLES[kind];
  const [row] = await db
    .select({
      id: table.id,
      name: table.name,
      createdAt: table.createdAt,
      productCount: count(products.id),
    })
    .from(table)
    .leftJoin(products, eq(fk, table.id))
    .where(eq(table.id, id))
    .groupBy(table.id, table.name, table.createdAt);
  if (!row) throw notFound(`${TABLES[kind].Label} not found`);
  return { ...row, createdAt: toIso(row.createdAt) };
}

export async function listTaxonomy(db: Database, kind: TaxonomyKind): Promise<TaxonomyDto[]> {
  const { table, fk } = TABLES[kind];
  const rows = await db
    .select({
      id: table.id,
      name: table.name,
      createdAt: table.createdAt,
      productCount: count(products.id),
    })
    .from(table)
    .leftJoin(products, eq(fk, table.id))
    .groupBy(table.id, table.name, table.createdAt)
    .orderBy(asc(table.name));
  return rows.map((row) => ({ ...row, createdAt: toIso(row.createdAt) }));
}

export async function createTaxonomy(db: Database, kind: TaxonomyKind, name: string) {
  const { table } = TABLES[kind];
  try {
    const [created] = await db.insert(table).values({ name }).$returningId();
    return findOne(db, kind, created!.id);
  } catch (err) {
    if (isDbError(err, DB_ERRNO.DUP_ENTRY)) throw duplicateName(kind, name);
    throw err;
  }
}

export async function renameTaxonomy(db: Database, kind: TaxonomyKind, id: string, name: string) {
  const { table } = TABLES[kind];
  await findOne(db, kind, id); // 404 if missing
  try {
    await db.update(table).set({ name }).where(eq(table.id, id));
  } catch (err) {
    if (isDbError(err, DB_ERRNO.DUP_ENTRY)) throw duplicateName(kind, name);
    throw err;
  }
  return findOne(db, kind, id);
}

export async function deleteTaxonomy(db: Database, kind: TaxonomyKind, id: string) {
  const { table } = TABLES[kind];
  const existing = await findOne(db, kind, id);
  if (existing.productCount > 0) throw inUse(kind, existing.productCount);
  try {
    await db.delete(table).where(eq(table.id, id));
  } catch (err) {
    // A product was assigned between the check and the delete: FK RESTRICT wins.
    if (isDbError(err, DB_ERRNO.ROW_IS_REFERENCED)) {
      throw inUse(kind, (await findOne(db, kind, id)).productCount);
    }
    throw err;
  }
}
