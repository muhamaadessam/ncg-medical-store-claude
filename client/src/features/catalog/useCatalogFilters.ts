import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { idSchema } from '@ncg/shared';

/** Read a filter id from the URL; anything that is not a UUID is ignored (never sent to the API). */
function readId(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key);
  return value && idSchema.safeParse(value).success ? value : undefined;
}

/** Brand / category filters stored in the URL as `?brand=<id>&category=<id>`. */
export function useCatalogFilters() {
  const [params, setParams] = useSearchParams();
  const brandId = readId(params, 'brand');
  const categoryId = readId(params, 'category');

  const update = useCallback(
    (key: 'brand' | 'category', id: string | undefined) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set(key, id);
          else next.delete(key);
          return next;
        },
        { preventScrollReset: true },
      );
    },
    [setParams],
  );

  return useMemo(
    () => ({
      brandId,
      categoryId,
      hasFilters: Boolean(brandId || categoryId),
      setBrand: (id: string | undefined) => update('brand', id),
      setCategory: (id: string | undefined) => update('category', id),
      clear: () =>
        setParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete('brand');
            next.delete('category');
            return next;
          },
          { preventScrollReset: true },
        ),
    }),
    [brandId, categoryId, update, setParams],
  );
}

/** Link to the home page filtered by brand and/or category. */
export function catalogFilterHref(filters: { brandId?: string; categoryId?: string }) {
  const params = new URLSearchParams();
  if (filters.brandId) params.set('brand', filters.brandId);
  if (filters.categoryId) params.set('category', filters.categoryId);
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}
