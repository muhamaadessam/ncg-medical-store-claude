/**
 * Pure cart-line operations. A line is one OFFER (pricing tier), keyed by `tierId`:
 * different tiers of the same product are separate lines; adding the same tier again adds bundles.
 * Prices are never stored here; they are joined from fresh catalog data when displayed.
 */

export const MIN_BUNDLES = 1;
export const MAX_BUNDLES = 99;

export interface CartLine {
  tierId: string;
  productId: string;
  bundles: number;
}

export function isValidBundles(value: unknown): value is number {
  return (
    Number.isInteger(value) && (value as number) >= MIN_BUNDLES && (value as number) <= MAX_BUNDLES
  );
}

/** Force any input into 1–99 (non-numbers become 1, decimals are truncated). */
export function clampBundles(value: unknown): number {
  const n = typeof value === 'string' ? Number(value.trim() || NaN) : Number(value);
  if (!Number.isFinite(n)) return MIN_BUNDLES;
  return Math.min(MAX_BUNDLES, Math.max(MIN_BUNDLES, Math.trunc(n)));
}

export interface AddResult {
  lines: CartLine[];
  /** True when the requested amount went over 99 and was capped. */
  capped: boolean;
  /** Bundles in the line after adding. */
  bundles: number;
}

export function addLine(
  lines: readonly CartLine[],
  item: { tierId: string; productId: string },
  bundles = 1,
): AddResult {
  const amount = clampBundles(bundles);
  const existing = lines.find((l) => l.tierId === item.tierId);
  const requested = (existing?.bundles ?? 0) + amount;
  const next = Math.min(MAX_BUNDLES, requested);
  const updated = existing
    ? lines.map((l) => (l.tierId === item.tierId ? { ...l, bundles: next } : l))
    : [...lines, { tierId: item.tierId, productId: item.productId, bundles: next }];
  return { lines: updated, capped: requested > MAX_BUNDLES, bundles: next };
}

/** Set a line's bundles; invalid values are clamped into 1–99. Unknown tiers are ignored. */
export function setLineBundles(
  lines: readonly CartLine[],
  tierId: string,
  bundles: unknown,
): CartLine[] {
  const value = clampBundles(bundles);
  return lines.map((l) => (l.tierId === tierId ? { ...l, bundles: value } : l));
}

export function removeLines(lines: readonly CartLine[], tierIds: Iterable<string>): CartLine[] {
  const remove = new Set(tierIds);
  return lines.filter((l) => !remove.has(l.tierId));
}

/** Make whatever came out of storage safe: drop malformed lines, merge duplicates, clamp. */
export function sanitizeLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  let lines: CartLine[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const { tierId, productId, bundles } = item as Record<string, unknown>;
    if (typeof tierId !== 'string' || !tierId || typeof productId !== 'string' || !productId)
      continue;
    lines = addLine(lines, { tierId, productId }, clampBundles(bundles)).lines;
  }
  return lines;
}
