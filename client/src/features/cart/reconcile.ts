import type { PricingTierDto, ProductDto } from '@ncg/shared';
import type { CartLine } from './cartLogic';

/** A cart line joined with FRESH catalog data (prices are never stored in the cart). */
export interface CartItem extends CartLine {
  product: ProductDto;
  tier: PricingTierDto;
}

/** What we know about each product in the cart. */
export type ProductLookup =
  | { status: 'loaded'; product: ProductDto }
  | { status: 'not-found' }
  | { status: 'pending' }
  | { status: 'error' };

export interface ReconcileResult {
  items: CartItem[];
  /** Lines whose offer definitely no longer exists (product deleted, or tier removed). */
  missingTierIds: string[];
  /** Lines we cannot show yet (still loading, or failed to load); never treated as missing. */
  unresolvedTierIds: string[];
}

/**
 * Join cart lines with catalog data. Only a definitive answer (404 or a loaded product without the
 * tier) marks a line as missing; loading or network errors keep the line untouched.
 */
export function reconcileCart(
  lines: readonly CartLine[],
  lookup: (productId: string) => ProductLookup,
): ReconcileResult {
  const result: ReconcileResult = { items: [], missingTierIds: [], unresolvedTierIds: [] };
  for (const line of lines) {
    const entry = lookup(line.productId);
    if (entry.status === 'not-found') {
      result.missingTierIds.push(line.tierId);
    } else if (entry.status === 'loaded') {
      const tier = entry.product.tiers.find((t) => t.id === line.tierId);
      if (tier) result.items.push({ ...line, product: entry.product, tier });
      else result.missingTierIds.push(line.tierId);
    } else {
      result.unresolvedTierIds.push(line.tierId);
    }
  }
  return result;
}

/** The numbers cart math needs, taken from the fresh tier. */
export function toPricedLine(item: CartItem) {
  return {
    bundles: item.bundles,
    unitsPerBundle: item.tier.unitsPerBundle,
    bundlePriceFils: item.tier.bundlePriceFils,
  };
}
