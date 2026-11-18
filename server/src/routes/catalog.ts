import { idSchema, productListQuerySchema } from '@ncg/shared';
import { Router } from 'express';
import { notFound } from '../middleware/errors';
import { parseOrThrow } from '../middleware/validation';
import { getProduct, listProducts } from '../services/catalog';
import { listTaxonomy } from '../services/taxonomy';
import type { ApiDeps } from './deps';

/** Public, read-only catalog endpoints. */
export function catalogRouter({ db }: ApiDeps) {
  const router = Router();

  router.get('/products', async (req, res) => {
    const filters = parseOrThrow(productListQuerySchema, req.query);
    res.json(await listProducts(db(), filters));
  });

  router.get('/products/:id', async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    const product = id.success ? await getProduct(db(), id.data) : undefined;
    if (!product) throw notFound('Product not found');
    res.json(product);
  });

  router.get('/brands', async (_req, res) => {
    res.json(await listTaxonomy(db(), 'brand'));
  });

  router.get('/categories', async (_req, res) => {
    res.json(await listTaxonomy(db(), 'category'));
  });

  return router;
}
