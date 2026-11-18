import { useEffect, useMemo } from 'react';
import type { ProductDto } from '@ncg/shared';
import { useQueries } from '@tanstack/react-query';
import { toast } from 'sonner';
import { catalogKeys } from '@/features/catalog/api';
import { ApiError, apiFetch } from '@/lib/api';
import { cartTotals } from './cartMath';
import { cartStore, useCartLines } from './cartStore';
import { reconcileCart, toPricedLine, type ProductLookup } from './reconcile';

export const OFFER_GONE_MESSAGE = 'An offer in your cart is no longer available';

/** Cart lines + fresh product data, totals, and automatic cleanup of offers that no longer exist. */
export function useCartView() {
  const lines = useCartLines();
  const productIds = useMemo(() => [...new Set(lines.map((l) => l.productId))], [lines]);

  const queries = useQueries({
    queries: productIds.map((id) => ({
      queryKey: catalogKeys.product(id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiFetch<ProductDto>(`/api/products/${encodeURIComponent(id)}`, { signal }),
      // Always re-check prices and availability when the cart is shown.
      staleTime: 0,
    })),
  });

  const lookupMap = new Map<string, ProductLookup>();
  productIds.forEach((id, i) => {
    const q = queries[i]!;
    if (q.data) lookupMap.set(id, { status: 'loaded', product: q.data });
    else if (q.error instanceof ApiError && q.error.status === 404)
      lookupMap.set(id, { status: 'not-found' });
    else if (q.isError) lookupMap.set(id, { status: 'error' });
    else lookupMap.set(id, { status: 'pending' });
  });

  const view = reconcileCart(lines, (id) => lookupMap.get(id) ?? { status: 'pending' });
  const missingKey = view.missingTierIds.join(',');

  // Drop lines whose offer was deleted in the admin, and tell the user once.
  useEffect(() => {
    if (!missingKey) return;
    const ids = missingKey.split(',');
    cartStore.remove(...ids);
    toast.warning(
      ids.length === 1
        ? OFFER_GONE_MESSAGE
        : `${ids.length} offers in your cart are no longer available`,
      { id: 'cart-offer-gone' },
    );
  }, [missingKey]);

  const failed = queries.filter(
    (q) => q.isError && !(q.error instanceof ApiError && q.error.status === 404),
  );

  return {
    lines,
    items: view.items,
    totals: cartTotals(view.items.map(toPricedLine)),
    isLoading: view.unresolvedTierIds.length > 0 && failed.length === 0,
    error: failed[0]?.error,
    retry: () => failed.forEach((q) => q.refetch()),
    isRetrying: failed.some((q) => q.isFetching),
  };
}
