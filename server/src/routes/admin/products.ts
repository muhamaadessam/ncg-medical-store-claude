import { idSchema, productInputSchema } from '@ncg/shared';
import { Router } from 'express';
import { notFound } from '../../middleware/errors';
import { parseOrThrow } from '../../middleware/validation';
import { createProduct, deleteProduct, updateProduct } from '../../services/products';
import type { ApiDeps } from '../deps';

export function productsAdminRouter({ db, uploadDir }: ApiDeps) {
  const router = Router();

  const parseId = (raw: string) => {
    const id = idSchema.safeParse(raw);
    if (!id.success) throw notFound('Product not found');
    return id.data;
  };

  router.post('/', async (req, res) => {
    const input = parseOrThrow(productInputSchema, req.body);
    const product = await createProduct(db(), input);
    res.status(201).location(`/api/products/${product.id}`).json(product);
  });

  router.put('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const input = parseOrThrow(productInputSchema, req.body);
    res.json(await updateProduct(db(), id, input, uploadDir));
  });

  router.delete('/:id', async (req, res) => {
    await deleteProduct(db(), parseId(req.params.id), uploadDir);
    res.status(204).end();
  });

  return router;
}
