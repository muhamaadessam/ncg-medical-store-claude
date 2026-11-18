import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { formatKWD, type ProductDto } from '@ncg/shared';
import { QuantityStepper } from '@/components/QuantityStepper';
import { EmptyState, ErrorState } from '@/components/StatusViews';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { lineTotalFils } from '@/features/cart/cartMath';
import { useAddToCart } from '@/features/cart/useAddToCart';
import { useProduct } from '@/features/catalog/api';
import { BundleSummary } from '@/features/catalog/components/BundleSummary';
import { ProductGallery } from '@/features/catalog/components/ProductGallery';
import { TierPicker } from '@/features/catalog/components/TierPicker';
import { catalogFilterHref } from '@/features/catalog/useCatalogFilters';
import { ApiError } from '@/lib/api';
import { usePageTitle } from '@/lib/usePageTitle';

export function ProductPage() {
  const { id } = useParams();
  const query = useProduct(id);
  usePageTitle(query.data?.name ?? (query.isError ? 'Product' : undefined));

  if (query.isPending) return <ProductSkeleton />;

  if (query.isError && !query.data) {
    if (query.error instanceof ApiError && query.error.status === 404) return <ProductNotFound />;
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorState
          headingLevel={1}
          title="We couldn't load this product"
          error={query.error}
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      </div>
    );
  }

  // `key` resets the selection when navigating to another product.
  return <ProductDetails key={query.data.id} product={query.data} />;
}

function ProductDetails({ product }: { product: ProductDto }) {
  const [selectedTierId, setSelectedTierId] = useState(product.tiers[0]?.id ?? '');
  const [bundles, setBundles] = useState(1);
  const addToCart = useAddToCart();

  // If the selected tier disappears after a refetch (admin edit), fall back to the first.
  const tier = product.tiers.find((t) => t.id === selectedTierId) ?? product.tiers[0];

  const handleAdd = () => {
    if (!tier) return;
    addToCart(
      { productId: product.id, productName: product.name, tierId: tier.id, tierLabel: tier.label },
      bundles,
    );
  };

  return (
    <div className="space-y-4">
      <BackLink />
      <div className="grid gap-6 md:grid-cols-2 md:gap-8 lg:gap-12">
        <div className="md:sticky md:top-22 md:self-start">
          <ProductGallery images={product.images} name={product.name} />
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" asChild>
                <Link to={catalogFilterHref({ brandId: product.brand.id })}>
                  {product.brand.name}
                </Link>
              </Badge>
              <Badge variant="outline" asChild>
                <Link to={catalogFilterHref({ categoryId: product.category.id })}>
                  {product.category.name}
                </Link>
              </Badge>
            </div>
            <h1 className="text-2xl leading-tight font-semibold sm:text-3xl">{product.name}</h1>
            {product.description && (
              <p className="leading-relaxed whitespace-pre-line text-muted-foreground">
                {product.description}
              </p>
            )}
          </div>

          {tier ? (
            <>
              <section aria-labelledby="bundle-heading" className="space-y-3">
                <h2 id="bundle-heading" className="font-semibold">
                  {product.tiers.length > 1 ? 'Choose a bundle' : 'Price'}
                </h2>
                <TierPicker
                  tiers={product.tiers}
                  value={tier.id}
                  onChange={setSelectedTierId}
                  productName={product.name}
                  name={`tier-${product.id}`}
                  size="lg"
                />
              </section>

              <QuantityStepper label="Bundles" value={bundles} onChange={setBundles} />

              <BundleSummary tier={tier} bundles={bundles} />

              <Button size="lg" className="hidden w-full md:inline-flex" onClick={handleAdd}>
                <ShoppingCart aria-hidden />
                Add to cart
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">This product has no offers right now.</p>
          )}
        </div>
      </div>
      {/* Mobile: sticks to the bottom of the screen while the page scrolls, then settles at the
          end of the content, so it never covers the footer. */}
      {tier && (
        <div className="sticky bottom-0 z-30 -mx-4 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground">
                {bundles} × {tier.label}
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {formatKWD(lineTotalFils({ bundlePriceFils: tier.bundlePriceFils, bundles }))}
              </p>
            </div>
            <Button size="lg" onClick={handleAdd}>
              <ShoppingCart aria-hidden />
              Add to cart
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Back to the listing: uses history when we came from inside the app (keeps filters). */
function BackLink() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasHistory = location.key !== 'default';
  return (
    <Link
      to="/"
      onClick={(e) => {
        if (hasHistory) {
          e.preventDefault();
          navigate(-1);
        }
      }}
      className="-ml-2 inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Back to products
    </Link>
  );
}

function ProductNotFound() {
  return (
    <div className="space-y-4">
      <BackLink />
      <EmptyState
        headingLevel={1}
        title="Product not found"
        description="It may have been removed, or the link is incorrect."
        action={
          <Button asChild>
            <Link to="/">Browse products</Link>
          </Button>
        }
      />
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading product">
      <Skeleton className="h-6 w-36" />
      <div className="grid gap-6 md:grid-cols-2 md:gap-8 lg:gap-12">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-28" />
          </div>
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}
