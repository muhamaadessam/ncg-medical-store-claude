import { Router } from 'express';
import { apiNotFoundHandler } from '../middleware/errors';
import { productsAdminRouter } from './admin/products';
import { taxonomyAdminRouter } from './admin/taxonomy';
import { uploadsAdminRouter } from './admin/uploads';
import { catalogRouter } from './catalog';
import type { ApiDeps } from './deps';
import { healthRouter } from './health';

export function apiRouter(deps: ApiDeps) {
  const api = Router();

  // API responses change after admin edits: never let browsers or Cloudflare cache them.
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  api.use('/health', healthRouter(deps));
  api.use('/', catalogRouter(deps));

  // Admin (no authentication: out of scope for this assessment).
  api.use('/admin/brands', taxonomyAdminRouter(deps, 'brand'));
  api.use('/admin/categories', taxonomyAdminRouter(deps, 'category'));
  api.use('/admin/products', productsAdminRouter(deps));
  api.use('/admin/uploads', uploadsAdminRouter(deps));

  api.use(apiNotFoundHandler);
  return api;
}
