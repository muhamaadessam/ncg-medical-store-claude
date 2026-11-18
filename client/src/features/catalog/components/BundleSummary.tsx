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
        'space-y-1 rounded-lg bg-muted/60 p-4 text-sm [&>div]:flex [&>div]:justify-between [&>div]:gap-4',
        className,
      )}
    >
      <div>
        <dt className="text-muted-foreground">Selection</dt>
        <dd className="text-right font-medium">
          {bundles} × {tier.label}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Total packs</dt>
        <dd className="text-right font-medium tabular-nums">{linePacks(line)}</dd>
      </div>
      <div className="mt-2 items-center border-t border-border pt-2">
        <dt className="font-semibold">Total</dt>
        <dd className="text-right text-lg font-semibold tabular-nums">
          {formatKWD(lineTotalFils(line))}
        </dd>
      </div>
    </dl>
  );
}
