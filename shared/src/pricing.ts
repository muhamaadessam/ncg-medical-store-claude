/**
 * Bundle pricing helpers. Everything is integer math on fils: prices are compared with
 * cross-multiplication instead of dividing (no floats).
 */

export interface TierPrice {
  id: string;
  unitsPerBundle: number;
  /** TOTAL price of the bundle in fils. */
  bundlePriceFils: number;
}

/**
 * Per-pack price, for DISPLAY only, rounded half-up to the nearest fils with integer arithmetic.
 * (55.000 KWD / 12 packs → 4583 fils.) Never use it for totals: totals use bundle prices.
 */
export function perPackFils(tier: Pick<TierPrice, 'unitsPerBundle' | 'bundlePriceFils'>): number {
  const { bundlePriceFils: price, unitsPerBundle: units } = tier;
  return Math.floor((2 * price + units) / (2 * units));
}

/** Negative when `a` is cheaper per pack than `b`, 0 when equal, positive when dearer. */
export function comparePerPack(a: TierPrice, b: TierPrice): number {
  return a.bundlePriceFils * b.unitsPerBundle - b.bundlePriceFils * a.unitsPerBundle;
}

/**
 * The tier with the lowest per-pack price, or undefined when there is only one tier or all
 * tiers cost the same per pack. Ties for the lowest price go to the bigger bundle.
 */
export function bestValueTierId(tiers: readonly TierPrice[]): string | undefined {
  if (tiers.length < 2) return undefined;
  let best = tiers[0]!;
  let allEqual = true;
  for (const tier of tiers.slice(1)) {
    const cmp = comparePerPack(tier, best);
    if (cmp !== 0) allEqual = false;
    if (cmp < 0 || (cmp === 0 && tier.unitsPerBundle > best.unitsPerBundle)) best = tier;
  }
  return allEqual ? undefined : best.id;
}

/**
 * Whole-percent saving per pack of `tier` versus `reference` (rounded down, so we never
 * overstate it). 0 when the tier is not cheaper.
 */
export function savingsPercent(tier: TierPrice, reference: TierPrice): number {
  // Both sides scaled by (tier.units × reference.units) so they stay integers:
  // referenceCost = what tier.units packs would cost at the reference per-pack rate.
  const referenceCost = reference.bundlePriceFils * tier.unitsPerBundle;
  const tierCost = tier.bundlePriceFils * reference.unitsPerBundle;
  const saved = referenceCost - tierCost;
  if (saved <= 0) return 0;
  return Math.floor((100 * saved) / referenceCost);
}

/** The tier with the highest per-pack price: the baseline that savings are shown against. */
export function baselineTier<T extends TierPrice>(tiers: readonly T[]): T | undefined {
  return tiers.reduce<T | undefined>(
    (worst, tier) => (!worst || comparePerPack(tier, worst) > 0 ? tier : worst),
    undefined,
  );
}
