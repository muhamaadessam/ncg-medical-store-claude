import { brandInputSchema, categoryInputSchema, idSchema } from '@ncg/shared';
import { Router } from 'express';
import { notFound } from '../../middleware/errors';
import { parseOrThrow } from '../../middleware/validation';
import {
  createTaxonomy,
  deleteTaxonomy,
  renameTaxonomy,
  type TaxonomyKind,
} from '../../services/taxonomy';
import type { ApiDeps } from '../deps';

/** POST / PATCH /:id / DELETE /:id for brands or categories. */
export function taxonomyAdminRouter({ db }: ApiDeps, kind: TaxonomyKind) {
  const router = Router();
  const schema = kind === 'brand' ? brandInputSchema : categoryInputSchema;
  const label = kind === 'brand' ? 'Brand' : 'Category';

  const parseId = (raw: string) => {
    const id = idSchema.safeParse(raw);
    if (!id.success) throw notFound(`${label} not found`);
    return id.data;
  };

  router.post('/', async (req, res) => {
    const { name } = parseOrThrow(schema, req.body);
    res.status(201).json(await createTaxonomy(db(), kind, name));
  });

  router.patch('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const { name } = parseOrThrow(schema, req.body);
    res.json(await renameTaxonomy(db(), kind, id, name));
  });

  router.delete('/:id', async (req, res) => {
    await deleteTaxonomy(db(), kind, parseId(req.params.id));
    res.status(204).end();
  });

  return router;
}
