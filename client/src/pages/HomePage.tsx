import type { ProductDto } from '@ncg/shared';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/StatusViews';
import { useAddToCart } from '@/features/cart/useAddToCart';
import { useBrands, useCategories, useProducts } from '@/features/catalog/api';
import {
  ClearFiltersButton,
  FilterChips,
  FilterList,
} from '@/features/catalog/components/CatalogFilters';
import { ProductCard, ProductCardSkeleton } from '@/features/catalog/components/ProductCard';
import { useCatalogFilters } from '@/features/catalog/useCatalogFilters';
import { usePageTitle } from '@/lib/usePageTitle';
import { cn } from '@/lib/utils';

export function HomePage() {
  usePageTitle('Shop');
  const filters = useCatalogFilters();
  const brands = useBrands();
  const categories = useCategories();
  const products = useProducts({ brandId: filters.brandId, categoryId: filters.categoryId });
  const addToCart = useAddToCart();

  const handleAdd = (product: ProductDto, tierId: string) => {
    const tier = product.tiers.find((t) => t.id === tierId);
    if (!tier) return;
    addToCart({ productId: product.id, productName: product.name, tierId, tierLabel: tier.label });
  };

  const activeNames = [
    brands.data?.find((b) => b.id === filters.brandId)?.name,
    categories.data?.find((c) => c.id === filters.categoryId)?.name,
  ].filter(Boolean);

  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
      <aside aria-label="Filters" className="hidden lg:block">
        <div className="sticky top-22 space-y-6">
          <FilterList
            title="Brands"
            query={brands}
            selectedId={filters.brandId}
            onSelect={filters.setBrand}
          />
          <FilterList
            title="Categories"
            query={categories}
            selectedId={filters.categoryId}
            onSelect={filters.setCategory}
          />
          {filters.hasFilters && <ClearFiltersButton onClick={filters.clear} className="w-full" />}
        </div>
      </aside>

      <section aria-labelledby="products-heading" className="min-w-0 space-y-4">
        <div className="space-y-1">
          <h1 id="products-heading" className="text-2xl font-semibold">
            {activeNames.length ? activeNames.join(' · ') : 'All products'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Medical supplies with bundle pricing: buy more packs, pay less per pack.
          </p>
        </div>

        <div className="space-y-2 lg:hidden">
          <FilterChips
            title="Brand"
            query={brands}
            selectedId={filters.brandId}
            onSelect={filters.setBrand}
          />
          <FilterChips
            title="Category"
            query={categories}
            selectedId={filters.categoryId}
            onSelect={filters.setCategory}
          />
        </div>

        {products.data && (
          <div className="flex min-h-9 items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {products.data.length} {products.data.length === 1 ? 'product' : 'products'}
            </p>
            {filters.hasFilters && (
              <ClearFiltersButton onClick={filters.clear} className="lg:hidden" />
            )}
          </div>
        )}

        <ProductResults
          query={products}
          hasFilters={filters.hasFilters}
          onClear={filters.clear}
          onAdd={handleAdd}
        />
      </section>
    </div>
  );
}

const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3';

function ProductResults({
  query,
  hasFilters,
  onClear,
  onAdd,
}: {
  query: ReturnType<typeof useProducts>;
  hasFilters: boolean;
  onClear: () => void;
  onAdd: (product: ProductDto, tierId: string) => void;
}) {
  if (query.isPending) {
    return (
      <div className={GRID} role="status" aria-label="Loading products">
        {Array.from({ length: 6 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (query.isError && !query.data) {
    return (
      <ErrorState
        title="We couldn't load the products"
        error={query.error}
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );
  }

  const products = query.data ?? [];
  if (products.length === 0) {
    return hasFilters ? (
      <EmptyState
        title="No products match these filters"
        description="Try another brand or category."
        action={<Button onClick={onClear}>Clear filters</Button>}
      />
    ) : (
      <EmptyState
        title="No products yet"
        description="Products added in the admin will appear here."
        action={
          <Button asChild variant="outline">
            <Link to="/admin">Go to admin</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div
      className={cn(GRID, query.isPlaceholderData && 'opacity-60 transition-opacity')}
      aria-busy={query.isPlaceholderData}
    >
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} onAdd={onAdd} eagerImage={index < 3} />
      ))}
    </div>
  );
}
