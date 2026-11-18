import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductDto } from '@ncg/shared';
import { EmptyState, ErrorState } from '@/components/StatusViews';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteProduct } from '@/features/admin/api';
import { ConfirmDeleteDialog } from '@/features/admin/components/ConfirmDeleteDialog';
import { matchesSearch, priceRange } from '@/features/admin/productSummary';
import { useProducts } from '@/features/catalog/api';
import { ProductImage } from '@/features/catalog/components/ProductImage';
import { usePageTitle } from '@/lib/usePageTitle';

export function AdminProductsPage() {
  usePageTitle('Admin · Products');
  const query = useProducts();
  const remove = useDeleteProduct();
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<ProductDto>();

  const products = useMemo(
    () => (query.data ?? []).filter((p) => matchesSearch(p, search)),
    [query.data, search],
  );

  return (
    <section aria-labelledby="products-admin-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="products-admin-heading" className="text-lg font-semibold">
          Products
        </h2>
        <Button asChild>
          <Link to="/admin/products/new">
            <Plus aria-hidden />
            New product
          </Link>
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, brand or category"
          aria-label="Search products"
          className="pl-9"
        />
      </div>

      {query.isPending ? (
        <div className="space-y-2" role="status" aria-label="Loading products">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState
          title="We couldn't load the products"
          error={query.error}
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.data.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Create your first product with its pricing tiers."
          action={
            <Button asChild>
              <Link to="/admin/products/new">New product</Link>
            </Button>
          }
        />
      ) : products.length === 0 ? (
        <EmptyState
          title={`No products match "${search.trim()}"`}
          action={
            <Button variant="outline" onClick={() => setSearch('')}>
              Clear search
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="w-0 px-4 py-3 font-medium">
                    <span className="sr-only">Image</span>
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Brand
                  </th>
                  <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Tiers
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Price range
                  </th>
                  <th scope="col" className="w-0 px-4 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-4 py-2">
                      <ProductImage
                        src={product.images[0]?.url}
                        alt=""
                        className="size-12 rounded-md border"
                      />
                    </td>
                    <td className="px-4 py-2 font-medium">
                      <Link
                        to={`/admin/products/${product.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{product.brand.name}</td>
                    <td className="hidden px-4 py-2 lg:table-cell">{product.category.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{product.tiers.length}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap tabular-nums">
                      {priceRange(product)}
                    </td>
                    <td className="px-2 py-1">
                      <RowActions product={product} onDelete={() => setDeleting(product)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden" aria-label="Products">
            {products.map((product) => (
              <li key={product.id} className="flex gap-3 rounded-xl border bg-card p-3 shadow-xs">
                <ProductImage
                  src={product.images[0]?.url}
                  alt=""
                  className="size-16 shrink-0 rounded-md border"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    to={`/admin/products/${product.id}`}
                    className="line-clamp-2 font-medium hover:text-primary hover:underline"
                  >
                    {product.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {product.brand.name} · {product.category.name}
                  </p>
                  <p className="text-xs">
                    {product.tiers.length} {product.tiers.length === 1 ? 'tier' : 'tiers'} ·{' '}
                    <span className="tabular-nums">{priceRange(product)}</span>
                  </p>
                </div>
                <RowActions product={product} onDelete={() => setDeleting(product)} vertical />
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={`Delete "${deleting?.name ?? ''}"?`}
        description="The product, its pricing tiers and images are removed. Carts holding it will drop the item."
        onConfirm={async () => {
          if (!deleting) return;
          await remove.mutateAsync(deleting.id);
          toast.success('Product deleted', { description: deleting.name });
        }}
      />
    </section>
  );
}

function RowActions({
  product,
  onDelete,
  vertical = false,
}: {
  product: ProductDto;
  onDelete: () => void;
  vertical?: boolean;
}) {
  return (
    <div className={vertical ? 'flex flex-col gap-1' : 'flex justify-end gap-1'}>
      <Button asChild variant="ghost" size="icon">
        <Link to={`/admin/products/${product.id}`} aria-label={`Edit ${product.name}`}>
          <Pencil aria-hidden />
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        aria-label={`Delete ${product.name}`}
        className="hover:text-destructive"
      >
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}
