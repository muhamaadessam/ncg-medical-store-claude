import { formatKWD, type PricingTierDto } from '@ncg/shared';
import { Badge } from '@/components/ui/badge';
import { RadioCard, RadioGroup } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { packs, useTierFacts } from '../tierFacts';

/** All tiers of a product as radio cards (multi-tier) or a plain price (single tier). */
export function TierPicker({
  tiers,
  value,
  onChange,
  productName,
  size = 'default',
  name,
}: {
  tiers: PricingTierDto[];
  value: string;
  onChange: (tierId: string) => void;
  productName: string;
  size?: 'default' | 'lg';
  /** Radio group name; must be unique on the page (e.g. the product id). */
  name?: string;
}) {
  const facts = useTierFacts(tiers);

  if (facts.length === 1) {
    const { tier } = facts[0]!;
    return (
      <div className="flex items-baseline justify-between gap-2">
        <p className={cn('font-semibold', size === 'lg' ? 'text-2xl' : 'text-xl')}>
          {formatKWD(tier.bundlePriceFils)}
        </p>
        <p className="text-sm text-muted-foreground">
          {tier.label}
          {tier.unitsPerBundle > 1 && ` · ${packs(tier.unitsPerBundle)}`}
        </p>
      </div>
    );
  }

  return (
    <RadioGroup
      value={value}
      onValueChange={onChange}
      aria-label={`Choose a bundle for ${productName}`}
      name={name}
      className={size === 'lg' ? 'gap-3' : 'gap-2'}
    >
      {facts.map(({ tier, perPackFils, isBestValue, savings }) => (
        <RadioCard key={tier.id} value={tier.id} className={size === 'lg' ? 'p-4' : 'p-3'}>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={cn('font-medium', size === 'lg' && 'text-base')}>{tier.label}</span>
              {isBestValue ? (
                <Badge variant="success">Best value{savings > 0 && ` · save ${savings}%`}</Badge>
              ) : (
                savings > 0 && <Badge variant="accent">Save {savings}%</Badge>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {tier.unitsPerBundle === 1 ? (
                'Single pack'
              ) : (
                <>
                  {packs(tier.unitsPerBundle)} ·{' '}
                  <span className="whitespace-nowrap">{formatKWD(perPackFils)} / pack</span>
                </>
              )}
            </span>
          </span>
          <span className={cn('shrink-0 font-semibold tabular-nums', size === 'lg' && 'text-base')}>
            {formatKWD(tier.bundlePriceFils)}
          </span>
        </RadioCard>
      ))}
    </RadioGroup>
  );
}
