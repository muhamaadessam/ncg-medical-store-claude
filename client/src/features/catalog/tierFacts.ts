import { useMemo } from 'react';
import {
  baselineTier,
  bestValueTierId,
  perPackFils,
  savingsPercent,
  type PricingTierDto,
} from '@ncg/shared';

export const packs = (n: number) => `${n} ${n === 1 ? 'pack' : 'packs'}`;

/** Per-tier display facts, all integer fils. */
export function useTierFacts(tiers: PricingTierDto[]) {
  return useMemo(() => {
    const bestId = bestValueTierId(tiers);
    const baseline = baselineTier(tiers);
    return tiers.map((tier) => ({
      tier,
      perPackFils: perPackFils(tier),
      isBestValue: tier.id === bestId,
      savings: baseline ? savingsPercent(tier, baseline) : 0,
    }));
  }, [tiers]);
}
