import { formatKWD, type PricingTierDto } from '@ncg/shared';
import { linePacks, lineTotalFils } from '@/features/cart/cartMath';
import { cn } from '@/lib/utils';

/** Live summary: `2 × 4 Packs` · `Total packs: 8` · `Total: 39.000 KWD`. */
export function BundleSummary({
  tier,
  bundles,
  className,
}: {
  tier: PricingTierDto;
  bundles: number;
  className?: string;
}) {
  const line = { ...tier, bundles };
  return (
    <dl
      aria-live="polite"
      className={cn(
        'grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg bg-muted/60 p-4 text-sm',
        className,
      )}
    >
      <dt className="text-muted-foreground">Selection</dt>
      <dd className="text-right font-medium">
        {bundles} × {tier.label}
      </dd>
      <dt className="text-muted-foreground">Total packs</dt>
      <dd className="text-right font-medium tabular-nums">{linePacks(line)}</dd>
      <div role="presentation" className="col-span-2 my-1 border-t border-border" />
      <dt className="self-center font-semibold">Total</dt>
      <dd className="text-right text-lg font-semibold tabular-nums">
        {formatKWD(lineTotalFils(line))}
      </dd>
    </dl>
  );
}
