import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductInput } from '@ncg/shared';
import { EmptyState, ErrorState } from '@/components/StatusViews';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { applyServerErrors, useSaveProduct } from '@/features/admin/api';
import {
  isProductFieldPath,
  ProductForm,
  type ProductFormApi,
} from '@/features/admin/components/ProductForm';
import { useBrands, useCategories, useProduct } from '@/features/catalog/api';
import { ApiError, errorMessage } from '@/lib/api';
import { usePageTitle } from '@/lib/usePageTitle';

export function AdminProductFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const product = useProduct(isNew ? undefined : id);
  const brands = useBrands();
  const categories = useCategories();
  const save = useSaveProduct();
  usePageTitle(isNew ? 'Admin · New product' : `Admin · ${product.data?.name ?? 'Edit product'}`);

  const handleSubmit = async (input: ProductInput, form: ProductFormApi) => {
    try {
      const saved = await save.mutateAsync({ id: isNew ? undefined : id, input });
      toast.success(isNew ? 'Product created' : 'Product saved', { description: saved.name });
      navigate('/admin/products');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        toast.error('This product no longer exists');
        navigate('/admin/products');
        return;
      }
      if (!applyServerErrors(err, form.setError, isProductFieldPath)) {
        form.setError('root', { message: errorMessage(err) });
      }
      toast.error('Product not saved', { description: errorMessage(err) });
    }
  };

  const queries = isNew ? [brands, categories] : [product, brands, categories];
  const failed = queries.find((q) => q.isError && !q.data);

  let body;
  if (!isNew && product.error instanceof ApiError && product.error.status === 404) {
    body = (
      <EmptyState
        title="Product not found"
        description="It may have been deleted."
        action={
          <Button asChild>
            <Link to="/admin/products">Back to products</Link>
          </Button>
        }
      />
    );
  } else if (failed) {
    body = (
      <ErrorState
        title="We couldn't load the form"
        error={failed.error}
        onRetry={() => queries.forEach((q) => q.isError && q.refetch())}
      />
    );
  } else if (queries.some((q) => q.isPending)) {
    body = (
      <div className="space-y-4" role="status" aria-label="Loading form">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  } else {
    body = (
      <ProductForm
        key={product.data?.id ?? 'new'}
        product={isNew ? undefined : product.data}
        brands={brands.data ?? []}
        categories={categories.data ?? []}
        onSubmit={handleSubmit}
        submitLabel={isNew ? 'Create product' : 'Save changes'}
      />
    );
  }

  return (
    <section aria-labelledby="product-form-heading" className="max-w-3xl space-y-4">
      <Link
        to="/admin/products"
        className="-ml-2 inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All products
      </Link>
      <h2 id="product-form-heading" className="text-lg font-semibold">
        {isNew ? 'New product' : `Edit ${product.data?.name ?? 'product'}`}
      </h2>
      {body}
    </section>
  );
}
