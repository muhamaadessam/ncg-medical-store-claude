import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import type { ProductDto } from '@ncg/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProductImage } from './ProductImage';
import { TierPicker } from './TierPicker';

export function ProductCard({
  product,
  onAdd,
  eagerImage = false,
}: {
  product: ProductDto;
  onAdd: (product: ProductDto, tierId: string) => void;
  eagerImage?: boolean;
}) {
  const [selectedTierId, setSelectedTierId] = useState(product.tiers[0]?.id ?? '');
  // If admin edits removed the selected tier, fall back to the first one.
  const tierId = product.tiers.some((t) => t.id === selectedTierId)
    ? selectedTierId
    : (product.tiers[0]?.id ?? '');
  const href = `/products/${product.id}`;

  return (
    <Card className="overflow-hidden">
      <Link to={href} tabIndex={-1} aria-hidden className="block">
        <ProductImage
          src={product.images[0]?.url}
          alt={product.name}
          eager={eagerImage}
          className="aspect-[5/4] w-full transition-transform duration-300 hover:scale-[1.02]"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{product.brand.name}</Badge>
            <Badge variant="outline">{product.category.name}</Badge>
          </div>
          <h2 className="text-base leading-snug font-semibold">
            <Link
              to={href}
              className="outline-none hover:text-primary hover:underline focus-visible:text-primary focus-visible:underline"
            >
              {product.name}
            </Link>
          </h2>
          {product.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
          )}
        </div>
        <div className="mt-auto space-y-3">
          <TierPicker
            tiers={product.tiers}
            value={tierId}
            onChange={setSelectedTierId}
            productName={product.name}
            name={`tier-${product.id}`}
          />
          <Button className="w-full" disabled={!tierId} onClick={() => onAdd(product, tierId)}>
            <ShoppingCart aria-hidden />
            Add to cart
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border" aria-hidden>
      <div className="aspect-[5/4] w-full animate-pulse bg-muted" />
      <div className="space-y-3 p-4">
        <div className="flex gap-2">
          <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
          <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-5 w-3/4 animate-pulse rounded-md bg-muted" />
        <div className="h-14 w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-14 w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
