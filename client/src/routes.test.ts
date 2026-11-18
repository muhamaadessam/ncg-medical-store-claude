import { isClientRoute } from '@ncg/shared';
import type { RouteObject } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { routes } from './routes';

/** Every concrete path the router defines, with params filled in (":id" → "sample-id"). */
function routePaths(list: RouteObject[], parent = ''): string[] {
  return list.flatMap((route) => {
    const own = route.path
      ? route.path.startsWith('/')
        ? route.path
        : `${parent.replace(/\/$/, '')}/${route.path}`
      : parent;
    const here = route.path && route.path !== '*' ? [own.replace(/:[^/]+/g, 'sample-id')] : [];
    return [...here, ...routePaths(route.children ?? [], own)];
  });
}

describe('server 404s stay in sync with the router', () => {
  it('every client route is known to the server (served with 200, not 404)', () => {
    const paths = routePaths(routes);
    expect(paths).toEqual(
      expect.arrayContaining(['/', '/cart', '/products/sample-id', '/admin', '/admin/brands']),
    );
    for (const path of paths) expect(isClientRoute(path), path).toBe(true);
  });
});
