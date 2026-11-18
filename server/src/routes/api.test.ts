import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ProductDto, TaxonomyDto } from '@ncg/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { Database } from '../db/client';
import { pricingTiers, products } from '../db/schema';
import { seedDatabase } from '../db/seed';
import { updateProduct } from '../services/products';
import { createBrandAndCategory, TINY_PNG, toInput, vitaminD } from '../test/fixtures';
import { connectTestDb, hasTestDb, truncateCatalog } from '../test/test-db';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe.skipIf(!hasTestDb)('REST API', () => {
  let db: Database;
  let close: () => Promise<void>;
  let uploadDir: string;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    ({ db, close } = connectTestDb());
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ncg-api-uploads-'));
    app = createApp({ serveClient: false, db, uploadDir });
  });
  afterAll(async () => {
    await close();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });
  beforeEach(() => truncateCatalog(db));

  const createProduct = async (body: object) => {
    const res = await request(app).post('/api/admin/products').send(body);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body as ProductDto;
  };

  describe('health', () => {
    it('reports the database as ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.database).toBe('ok');
    });
  });

  describe('public catalog', () => {
    beforeEach(() => seedDatabase(db, { uploadDir }));

    it('GET /api/products returns products with brand, category, images and fils prices', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(200);
      const list = res.body as ProductDto[];
      expect(list.map((p) => p.name)).toEqual([
        'Digital Thermometer',
        'Omega-3 Fish Oil (90 softgels)',
        'Sterile Gauze Pads (10 pcs)',
        'Vitamin D3 1000 IU (60 caps)',
      ]);
      const vitD = list.find((p) => p.name.startsWith('Vitamin D3'))!;
      expect(vitD.brand.name).toBe('MediCare');
      expect(vitD.category.name).toBe('Vitamins & Supplements');
      expect(vitD.images.map((i) => i.url)).toEqual([
        '/uploads/seed-vitd3.jpg',
        '/uploads/seed-vitd3-caps.jpg',
      ]);
      expect(vitD.tiers.map((t) => [t.label, t.unitsPerBundle, t.bundlePriceFils])).toEqual([
        ['1 Pack', 1, 5500],
        ['4 Packs', 4, 19500],
        ['12 Packs', 12, 55000],
      ]);
      expect(vitD.tiers[0]).not.toHaveProperty('bundlePrice');
    });

    it('filters by brand, by category and by both (AND)', async () => {
      const brands = (await request(app).get('/api/brands')).body as TaxonomyDto[];
      const cats = (await request(app).get('/api/categories')).body as TaxonomyDto[];
      const mediCare = brands.find((b) => b.name === 'MediCare')!;
      const firstAid = cats.find((c) => c.name === 'First Aid')!;

      const byBrand = await request(app).get(`/api/products?brandId=${mediCare.id}`);
      expect(byBrand.body.map((p: ProductDto) => p.name)).toEqual([
        'Digital Thermometer',
        'Vitamin D3 1000 IU (60 caps)',
      ]);
      const byCategory = await request(app).get(`/api/products?categoryId=${firstAid.id}`);
      expect(byCategory.body).toHaveLength(2);
      const both = await request(app).get(
        `/api/products?brandId=${mediCare.id}&categoryId=${firstAid.id}`,
      );
      expect(both.body.map((p: ProductDto) => p.name)).toEqual(['Digital Thermometer']);
      const none = await request(app).get(`/api/products?brandId=${UNKNOWN_ID}`);
      expect(none.status).toBe(200);
      expect(none.body).toEqual([]);
    });

    it('rejects malformed filter ids with 400', async () => {
      const res = await request(app).get('/api/products?brandId=abc');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual([{ path: 'brandId', message: 'Invalid brandId' }]);
    });

    it('GET /api/products/:id returns one product, 404 JSON when missing', async () => {
      const [first] = (await request(app).get('/api/products')).body as ProductDto[];
      const res = await request(app).get(`/api/products/${first!.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(first);

      for (const id of [UNKNOWN_ID, 'not-a-uuid']) {
        const missing = await request(app).get(`/api/products/${id}`);
        expect(missing.status).toBe(404);
        expect(missing.body).toEqual({
          error: { code: 'NOT_FOUND', message: 'Product not found' },
        });
      }
    });

    it('GET /api/brands and /api/categories include product counts', async () => {
      const brands = await request(app).get('/api/brands');
      expect(brands.body.map((b: TaxonomyDto) => [b.name, b.productCount])).toEqual([
        ['MediCare', 2],
        ['PharmaPlus', 2],
      ]);
      await request(app).post('/api/admin/categories').send({ name: 'Baby Care' });
      const cats = await request(app).get('/api/categories');
      expect(cats.body.map((c: TaxonomyDto) => [c.name, c.productCount])).toEqual([
        ['Baby Care', 0],
        ['First Aid', 2],
        ['Vitamins & Supplements', 2],
      ]);
    });

    it('sends no-store cache headers', async () => {
      const res = await request(app).get('/api/products');
      expect(res.headers['cache-control']).toBe('no-store');
    });
  });

  describe.each([
    ['brands', 'brand'],
    ['categories', 'category'],
  ] as const)('admin %s', (resource, label) => {
    const base = `/api/admin/${resource}`;

    it('creates, renames and deletes', async () => {
      const created = await request(app).post(base).send({ name: '  Alpha  ' });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ name: 'Alpha', productCount: 0 });

      const renamed = await request(app).patch(`${base}/${created.body.id}`).send({ name: 'Beta' });
      expect(renamed.status).toBe(200);
      expect(renamed.body.name).toBe('Beta');

      const deleted = await request(app).delete(`${base}/${created.body.id}`);
      expect(deleted.status).toBe(204);
      const list = await request(app).get(`/api/${resource}`);
      expect(list.body).toEqual([]);
    });

    it('rejects duplicate names (case-insensitive) with 409', async () => {
      await request(app).post(base).send({ name: 'Alpha' });
      const dup = await request(app).post(base).send({ name: 'ALPHA' });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('DUPLICATE_NAME');
      expect(dup.body.error.message).toBe(`A ${label} named "ALPHA" already exists.`);

      const other = await request(app).post(base).send({ name: 'Gamma' });
      const rename = await request(app).patch(`${base}/${other.body.id}`).send({ name: 'alpha' });
      expect(rename.status).toBe(409);
    });

    it('validates names with 400 and field details', async () => {
      const res = await request(app).post(base).send({ name: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ path: 'name', message: 'Name is required' }],
      });
      expect((await request(app).post(base).send({})).status).toBe(400);
    });

    it('returns 404 for unknown ids', async () => {
      expect((await request(app).patch(`${base}/${UNKNOWN_ID}`).send({ name: 'X' })).status).toBe(
        404,
      );
      expect((await request(app).delete(`${base}/${UNKNOWN_ID}`)).status).toBe(404);
      expect((await request(app).delete(`${base}/nope`)).status).toBe(404);
    });

    it('refuses to delete while products use it (RESTRICT) with 409', async () => {
      const { brandId, categoryId } = await createBrandAndCategory(db);
      await createProduct(vitaminD(brandId, categoryId));
      await createProduct({ ...vitaminD(brandId, categoryId), name: 'Second product' });
      const id = resource === 'brands' ? brandId : categoryId;

      const res = await request(app).delete(`${base}/${id}`);
      expect(res.status).toBe(409);
      expect(res.body.error).toEqual({
        code: 'IN_USE',
        message: `Cannot delete: 2 products use this ${label}. Reassign them first.`,
        details: { productCount: 2 },
      });
    });
  });

  describe('admin products', () => {
    let brandId: string;
    let categoryId: string;
    beforeEach(async () => {
      ({ brandId, categoryId } = await createBrandAndCategory(db));
    });

    it('creates a product with tiers in one request', async () => {
      const res = await request(app)
        .post('/api/admin/products')
        .send(vitaminD(brandId, categoryId));
      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(`/api/products/${res.body.id}`);
      const product = res.body as ProductDto;
      expect(product.tiers.map((t) => [t.unitsPerBundle, t.bundlePriceFils, t.sortOrder])).toEqual([
        [1, 5500, 0],
        [4, 19500, 1],
        [12, 55000, 2],
      ]);
      const fetched = await request(app).get(`/api/products/${product.id}`);
      expect(fetched.body).toEqual(product);
    });

    it('accepts prices as "19.5" and stores them exactly', async () => {
      const product = await createProduct({
        ...vitaminD(brandId, categoryId),
        tiers: [{ label: '4 Packs', unitsPerBundle: 4, bundlePrice: '19.5' }],
      });
      expect(product.tiers[0]!.bundlePriceFils).toBe(19500);
      const [row] = await db.select().from(pricingTiers);
      expect(row!.bundlePrice).toBe('19.500');
    });

    it.each([
      ['no tiers', { tiers: [] }, ['tiers']],
      [
        'units 0',
        { tiers: [{ label: 'A', unitsPerBundle: 0, bundlePrice: '1' }] },
        ['tiers.0.unitsPerBundle'],
      ],
      [
        'non-integer units',
        { tiers: [{ label: 'A', unitsPerBundle: 1.5, bundlePrice: '1' }] },
        ['tiers.0.unitsPerBundle'],
      ],
      [
        'price 0',
        { tiers: [{ label: 'A', unitsPerBundle: 1, bundlePrice: '0' }] },
        ['tiers.0.bundlePrice'],
      ],
      [
        '4 decimals',
        { tiers: [{ label: 'A', unitsPerBundle: 1, bundlePrice: '1.2345' }] },
        ['tiers.0.bundlePrice'],
      ],
      [
        'duplicate units',
        {
          tiers: [
            { label: 'A', unitsPerBundle: 2, bundlePrice: '1' },
            { label: 'B', unitsPerBundle: 2, bundlePrice: '2' },
          ],
        },
        ['tiers.1.unitsPerBundle'],
      ],
      ['missing name', { name: '' }, ['name']],
      ['bad image url', { images: ['https://example.com/x.jpg'] }, ['images.0']],
    ])('rejects %s with 400', async (_case, override, paths) => {
      const res = await request(app)
        .post('/api/admin/products')
        .send({ ...vitaminD(brandId, categoryId), ...override });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(paths);
      expect(await db.select().from(products)).toHaveLength(0);
    });

    it('rejects unknown brand/category ids with 400', async () => {
      const res = await request(app)
        .post('/api/admin/products')
        .send({ ...vitaminD(brandId, categoryId), brandId: UNKNOWN_ID, categoryId: UNKNOWN_ID });
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual([
        'brandId',
        'categoryId',
      ]);
      expect(await db.select().from(products)).toHaveLength(0);
    });

    it('PUT keeps unchanged tiers, updates changed ones, adds and removes', async () => {
      const product = await createProduct(vitaminD(brandId, categoryId));
      const [one, four, twelve] = product.tiers;
      const input = toInput(product);
      input.name = 'Vitamin D3 (renamed)';
      input.tiers = [
        input.tiers[0]!, // unchanged
        { ...input.tiers[1]!, bundlePrice: '18.750' }, // price change, same units
        // 12-pack removed
        { label: '24 Packs', unitsPerBundle: 24, bundlePrice: '99.000' }, // new
      ];

      const res = await request(app).put(`/api/admin/products/${product.id}`).send(input);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      const updated = res.body as ProductDto;
      expect(updated.name).toBe('Vitamin D3 (renamed)');
      expect(updated.tiers.map((t) => [t.unitsPerBundle, t.bundlePriceFils])).toEqual([
        [1, 5500],
        [4, 18750],
        [24, 99000],
      ]);
      expect(updated.tiers[0]!.id).toBe(one!.id); // untouched
      expect(updated.tiers[1]!.id).toBe(four!.id); // same bundle size keeps its identity
      expect(updated.tiers.map((t) => t.id)).not.toContain(twelve!.id); // removed
      expect(await db.select().from(pricingTiers)).toHaveLength(3);
    });

    it('PUT can swap units between tiers without violating UNIQUE(product, units)', async () => {
      const product = await createProduct(vitaminD(brandId, categoryId));
      const input = toInput(product);
      input.tiers = [
        { ...input.tiers[0]!, unitsPerBundle: 4, label: '4 Packs', bundlePrice: '19.500' },
        { ...input.tiers[1]!, unitsPerBundle: 1, label: '1 Pack', bundlePrice: '5.500' },
        input.tiers[2]!,
      ];
      const res = await request(app).put(`/api/admin/products/${product.id}`).send(input);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.tiers.map((t: { unitsPerBundle: number }) => t.unitsPerBundle)).toEqual([
        4, 1, 12,
      ]);
    });

    it('PUT reorders tiers by array position', async () => {
      const product = await createProduct(vitaminD(brandId, categoryId));
      const input = toInput(product);
      input.tiers.reverse();
      const res = await request(app).put(`/api/admin/products/${product.id}`).send(input);
      expect(res.body.tiers.map((t: { unitsPerBundle: number }) => t.unitsPerBundle)).toEqual([
        12, 4, 1,
      ]);
    });

    it('PUT ignores tier ids that belong to another product', async () => {
      const a = await createProduct(vitaminD(brandId, categoryId));
      const b = await createProduct({ ...vitaminD(brandId, categoryId), name: 'Other' });
      const input = toInput(b);
      input.tiers[0] = { ...input.tiers[0]!, id: a.tiers[0]!.id, bundlePrice: '1.000' };
      const res = await request(app).put(`/api/admin/products/${b.id}`).send(input);
      expect(res.status).toBe(200);
      const after = await request(app).get(`/api/products/${a.id}`);
      expect(after.body).toEqual(a); // product A untouched
    });

    it('rolls the whole update back when a write fails mid-transaction', async () => {
      const product = await createProduct(vitaminD(brandId, categoryId));
      const input = toInput(product);
      // Bypass zod on purpose: units 0 passes the tier diff, then the DB CHECK rejects the insert
      // AFTER the product row was updated and old tiers were deleted.
      const bad = {
        ...input,
        name: 'Should not be saved',
        description: input.description ?? null,
        images: [],
        tiers: [{ label: 'Broken', unitsPerBundle: 0, bundlePrice: '1.000' }],
      };
      await expect(updateProduct(db, product.id, bad)).rejects.toMatchObject({ status: 400 });

      const after = await request(app).get(`/api/products/${product.id}`);
      expect(after.body).toEqual(product);
    });

    it('PUT returns 404 for unknown products and 400 for invalid bodies', async () => {
      const body = vitaminD(brandId, categoryId);
      expect((await request(app).put(`/api/admin/products/${UNKNOWN_ID}`).send(body)).status).toBe(
        404,
      );
      const product = await createProduct(body);
      const res = await request(app)
        .put(`/api/admin/products/${product.id}`)
        .send({ ...body, tiers: [] });
      expect(res.status).toBe(400);
    });

    it('DELETE removes the product with its tiers and images', async () => {
      const product = await createProduct(vitaminD(brandId, categoryId));
      expect((await request(app).delete(`/api/admin/products/${product.id}`)).status).toBe(204);
      expect((await request(app).get(`/api/products/${product.id}`)).status).toBe(404);
      expect(await db.select().from(pricingTiers)).toHaveLength(0);
      expect((await request(app).delete(`/api/admin/products/${product.id}`)).status).toBe(404);
    });

    it('updates updatedAt on PUT', async () => {
      const product = await createProduct(vitaminD(brandId, categoryId));
      await db
        .update(products)
        .set({ updatedAt: new Date('2020-01-01T00:00:00Z') })
        .where(eq(products.id, product.id));
      const res = await request(app)
        .put(`/api/admin/products/${product.id}`)
        .send(toInput(product));
      expect(new Date(res.body.updatedAt).getFullYear()).toBeGreaterThan(2020);
    });
  });

  describe('uploads', () => {
    it('stores an image under a random name and serves it', async () => {
      const res = await request(app)
        .post('/api/admin/uploads')
        .attach('image', TINY_PNG, { filename: '../../evil name.png', contentType: 'image/png' });
      expect(res.status).toBe(201);
      expect(res.body.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
      expect(fs.existsSync(path.join(uploadDir, path.basename(res.body.url)))).toBe(true);

      const served = await request(app).get(res.body.url);
      expect(served.status).toBe(200);
      expect(served.headers['content-type']).toBe('image/png');
    });

    it('rejects non-images (415), including fake image MIME types', async () => {
      const text = await request(app)
        .post('/api/admin/uploads')
        .attach('image', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
      expect(text.status).toBe(415);
      expect(text.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');

      const svg = await request(app)
        .post('/api/admin/uploads')
        .attach('image', Buffer.from('<svg/>'), {
          filename: 'a.svg',
          contentType: 'image/svg+xml',
        });
      expect(svg.status).toBe(415);

      const before = fs.readdirSync(uploadDir).length;
      const spoofed = await request(app)
        .post('/api/admin/uploads')
        .attach('image', Buffer.from('<script>alert(1)</script>'), {
          filename: 'x.png',
          contentType: 'image/png',
        });
      expect(spoofed.status).toBe(415);
      expect(fs.readdirSync(uploadDir).length).toBe(before); // nothing left on disk
    });

    it('rejects files over 3 MB with 413', async () => {
      const big = Buffer.concat([TINY_PNG, Buffer.alloc(3 * 1024 * 1024)]);
      const res = await request(app)
        .post('/api/admin/uploads')
        .attach('image', big, { filename: 'big.png', contentType: 'image/png' });
      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    });

    it('requires a file (400)', async () => {
      const res = await request(app).post('/api/admin/uploads').field('x', '1');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_UPLOAD');
    });

    it('deletes image files no product uses any more', async () => {
      const { brandId, categoryId } = await createBrandAndCategory(db);
      const upload = await request(app)
        .post('/api/admin/uploads')
        .attach('image', TINY_PNG, { filename: 'a.png', contentType: 'image/png' });
      const file = path.join(uploadDir, path.basename(upload.body.url));
      const product = await createProduct({
        ...vitaminD(brandId, categoryId),
        images: [upload.body.url],
      });
      expect(fs.existsSync(file)).toBe(true);

      await request(app)
        .put(`/api/admin/products/${product.id}`)
        .send({ ...toInput(product), images: [] });
      expect(fs.existsSync(file)).toBe(false);
    });
  });
});
