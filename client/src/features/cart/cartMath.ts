/**
 * Pure cart math on integer fils. Line total = bundle price × bundles (bundle price is the TOTAL
 * for the bundle, never per pack); packs = units per bundle × bundles.
 */

export interface PricedLine {
  bundles: number;
  unitsPerBundle: number;
  bundlePriceFils: number;
}

function assertInt(name: string, value: number) {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${name} must be an integer, got ${value}`);
}

export function lineTotalFils({
  bundlePriceFils,
  bundles,
}: Pick<PricedLine, 'bundlePriceFils' | 'bundles'>) {
  assertInt('bundlePriceFils', bundlePriceFils);
  assertInt('bundles', bundles);
  return bundlePriceFils * bundles;
}

export function linePacks({
  unitsPerBundle,
  bundles,
}: Pick<PricedLine, 'unitsPerBundle' | 'bundles'>) {
  assertInt('unitsPerBundle', unitsPerBundle);
  assertInt('bundles', bundles);
  return unitsPerBundle * bundles;
}

export interface CartTotals {
  subtotalFils: number;
  totalBundles: number;
  totalPacks: number;
  lineCount: number;
}

export function cartTotals(lines: readonly PricedLine[]): CartTotals {
  return lines.reduce<CartTotals>(
    (acc, line) => ({
      subtotalFils: acc.subtotalFils + lineTotalFils(line),
      totalBundles: acc.totalBundles + line.bundles,
      totalPacks: acc.totalPacks + linePacks(line),
      lineCount: acc.lineCount + 1,
    }),
    { subtotalFils: 0, totalBundles: 0, totalPacks: 0, lineCount: 0 },
  );
}
