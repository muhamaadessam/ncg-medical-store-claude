import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { formatKWD } from '@ncg/shared';
import { QuantityStepper } from '@/components/QuantityStepper';
import { Button } from '@/components/ui/button';
import { ProductImage } from '@/features/catalog/components/ProductImage';
import { packs } from '@/features/catalog/tierFacts';
import { linePacks, lineTotalFils } from '../cartMath';
import { toPricedLine, type CartItem } from '../reconcile';

/**
 * One cart line. Below 1024px: a card. From lg: a table-like row aligned with CartTableHeader.
 */
export function CartLineItem({
  item,
  onBundlesChange,
  onRemove,
}: {
  item: CartItem;
  onBundlesChange: (bundles: number) => void;
  onRemove: () => void;
}) {
  const { product, tier, bundles } = item;
  const href = `/products/${product.id}`;
  const context = `${tier.label}, ${product.name}`;

  return (
    <li className="grid grid-cols-[4.5rem_1fr_auto] gap-x-3 gap-y-3 py-4 lg:grid-cols-[4.5rem_minmax(0,1fr)_8rem_9.5rem_8rem_2.5rem] lg:items-center lg:gap-x-4">
      <Link to={href} tabIndex={-1} aria-hidden className="row-span-2 lg:row-span-1">
        <ProductImage src={product.images[0]?.url} alt="" className="size-18 rounded-lg border" />
      </Link>

      <div className="min-w-0 space-y-1">
        <Link to={href} className="line-clamp-2 font-medium hover:text-primary hover:underline">
          {product.name}
        </Link>
        <p className="text-sm">
          <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">
            {tier.label}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {bundles} × {tier.label} = {packs(linePacks(toPricedLine(item)))}
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label={`Remove ${context}`}
        className="self-start text-muted-foreground hover:text-destructive lg:order-last lg:self-center"
      >
        <Trash2 aria-hidden />
      </Button>

      {/* Cards (< 1024px): price, then stepper + total. Rows (lg+): their own columns. */}
      <div className="col-span-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 lg:contents">
        <p className="basis-full text-sm lg:basis-auto lg:text-right">
          <span className="text-muted-foreground lg:hidden">Bundle price </span>
          <span className="tabular-nums">{formatKWD(tier.bundlePriceFils)}</span>
        </p>
        <QuantityStepper
          value={bundles}
          onChange={onBundlesChange}
          label="Bundles"
          hideLabel
          size="sm"
          context={context}
          className="lg:justify-self-center"
        />
        <p className="text-right font-semibold tabular-nums lg:text-base">
          <span className="font-normal text-muted-foreground lg:hidden">Total </span>
          {formatKWD(lineTotalFils(toPricedLine(item)))}
        </p>
      </div>
    </li>
  );
}

export function CartTableHeader() {
  return (
    <div
      aria-hidden
      className="hidden grid-cols-[4.5rem_minmax(0,1fr)_8rem_9.5rem_8rem_2.5rem] gap-x-4 border-b pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase lg:grid"
    >
      <span className="col-span-2">Product</span>
      <span className="text-right">Bundle price</span>
      <span className="text-center">Bundles</span>
      <span className="text-right">Total</span>
      <span />
    </div>
  );
}
