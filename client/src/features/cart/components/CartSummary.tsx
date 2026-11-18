import { useId } from 'react';
import { formatKWD } from '@ncg/shared';
import { Button } from '@/components/ui/button';
import type { CartTotals } from '../cartMath';

export const CHECKOUT_DISABLED_REASON = 'Checkout is out of scope for this demo.';

export function CartSummary({ totals }: { totals: CartTotals }) {
  const tooltipId = useId();
  return (
    <section
      aria-labelledby="summary-heading"
      className="space-y-4 rounded-xl border bg-card p-5 shadow-xs"
    >
      <h2 id="summary-heading" className="text-lg font-semibold">
        Order summary
      </h2>
      <dl className="space-y-2 text-sm [&>div]:flex [&>div]:justify-between [&>div]:gap-4">
        <div>
          <dt className="text-muted-foreground">Bundles</dt>
          <dd className="tabular-nums">{totals.totalBundles}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Packs</dt>
          <dd className="tabular-nums">{totals.totalPacks}</dd>
        </div>
        <div className="items-center border-t border-border pt-3">
          <dt className="font-semibold">Subtotal</dt>
          <dd className="text-xl font-semibold tabular-nums">{formatKWD(totals.subtotalFils)}</dd>
        </div>
      </dl>

      {/* aria-disabled (not disabled) keeps it focusable so keyboard users get the tooltip too. */}
      <div className="group relative">
        <Button
          size="lg"
          className="w-full cursor-not-allowed opacity-60"
          aria-disabled="true"
          aria-describedby={tooltipId}
          onClick={(e) => e.preventDefault()}
        >
          Checkout
        </Button>
        <p
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute top-full left-1/2 z-10 mt-2 w-max max-w-60 -translate-x-1/2 rounded-md bg-foreground px-3 py-1.5 text-xs text-background opacity-0 shadow transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        >
          {CHECKOUT_DISABLED_REASON}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Prices are checked against the live catalog every time you open the cart.
      </p>
    </section>
  );
}
