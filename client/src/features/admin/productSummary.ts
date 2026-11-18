import { formatKWD, type ProductDto } from '@ncg/shared';

/** "5.500 – 55.000 KWD" (lowest to highest bundle price), or a single price. */
export function priceRange(product: Pick<ProductDto, 'tiers'>): string {
  const prices = product.tiers.map((t) => t.bundlePriceFils);
  if (prices.length === 0) return '—';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatKWD(min) : `${formatKWD(min).replace(' KWD', '')} – ${formatKWD(max)}`;
}

/** Case-insensitive match on product, brand or category name. */
export function matchesSearch(product: ProductDto, search: string): boolean {
  const q = search.trim().toLocaleLowerCase();
  if (!q) return true;
  return [product.name, product.brand.name, product.category.name].some((s) =>
    s.toLocaleLowerCase().includes(q),
  );
}
