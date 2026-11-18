import type { BrandDto, CategoryDto, ProductDto, ProductListQuery } from '@ncg/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

/** Every catalog query lives under ['catalog'] so admin mutations can invalidate them all at once. */
export const catalogKeys = {
  all: ['catalog'] as const,
  products: (filters: ProductListQuery = {}) => ['catalog', 'products', filters] as const,
  product: (id: string) => ['catalog', 'product', id] as const,
  brands: ['catalog', 'brands'] as const,
  categories: ['catalog', 'categories'] as const,
};

function productsUrl(filters: ProductListQuery) {
  const params = new URLSearchParams();
  if (filters.brandId) params.set('brandId', filters.brandId);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  const qs = params.toString();
  return `/api/products${qs ? `?${qs}` : ''}`;
}

export function useProducts(filters: ProductListQuery = {}) {
  return useQuery({
    queryKey: catalogKeys.products(filters),
    queryFn: ({ signal }) => apiFetch<ProductDto[]>(productsUrl(filters), { signal }),
    // Keep showing the previous results while a new filter loads (no skeleton flash).
    placeholderData: keepPreviousData,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: catalogKeys.brands,
    queryFn: ({ signal }) => apiFetch<BrandDto[]>('/api/brands', { signal }),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: catalogKeys.categories,
    queryFn: ({ signal }) => apiFetch<CategoryDto[]>('/api/categories', { signal }),
  });
}

export function useProduct(id: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery<ProductDto, Error, ProductDto, ReturnType<typeof catalogKeys.product>>({
    queryKey: catalogKeys.product(id ?? ''),
    queryFn: ({ signal }) =>
      apiFetch<ProductDto>(`/api/products/${encodeURIComponent(id!)}`, { signal }),
    enabled: Boolean(id),
    // Coming from the listing: show the product we already have while fresh data loads.
    placeholderData: () =>
      queryClient
        .getQueriesData<ProductDto[]>({ queryKey: ['catalog', 'products'] })
        .flatMap(([, list]) => list ?? [])
        .find((p) => p.id === id),
  });
}
