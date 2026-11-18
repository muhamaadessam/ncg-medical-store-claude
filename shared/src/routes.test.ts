import { describe, expect, it } from 'vitest';
import { isClientRoute } from './routes';

describe('isClientRoute', () => {
  it.each([
    '/',
    '/cart',
    '/cart/',
    '/products/abc-123',
    '/admin',
    '/admin/',
    '/admin/products/new',
  ])('accepts %s', (path) => expect(isClientRoute(path)).toBe(true));

  it.each([
    '/some/random/page',
    '/products',
    '/products/',
    '/products/a/b',
    '/cartx',
    '/administrator',
    '',
  ])('rejects %j', (path) => expect(isClientRoute(path)).toBe(false));
});
