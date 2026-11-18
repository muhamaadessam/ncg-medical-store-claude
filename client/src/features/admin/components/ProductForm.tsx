import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  MAX_IMAGES_PER_PRODUCT,
  productInputSchema,
  type BrandDto,
  type CategoryDto,
  type ProductDto,
  type ProductFormValues,
  type ProductInput,
} from '@ncg/shared';
import { FormField } from '@/components/FormField';
import { fieldAria } from '@/lib/fieldAria';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { toFormValues } from '../productForm';
import { ImagesField } from './ImagesField';
import { TiersField } from './TiersField';

export type ProductFormApi = ReturnType<typeof useForm<ProductFormValues, unknown, ProductInput>>;

export function ProductForm({
  product,
  brands,
  categories,
  onSubmit,
  submitLabel,
}: {
  product?: ProductDto;
  brands: BrandDto[];
  categories: CategoryDto[];
  /** Resolves when saved; may use `form.setError` for server errors. */
  onSubmit: (input: ProductInput, form: ProductFormApi) => Promise<void>;
  submitLabel: string;
}) {
  const form = useForm<ProductFormValues, unknown, ProductInput>({
    resolver: zodResolver(productInputSchema),
    defaultValues: toFormValues(product),
    // Errors appear on the first submit, then update live while typing. ('onTouched' would mark
    // every tier invalid as soon as one tier field loses focus, because errors are set per array.)
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const { register, control, formState } = form;
  const { errors, isSubmitting, isDirty, isSubmitSuccessful } = formState;

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!isDirty || isSubmitSuccessful) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty, isSubmitSuccessful]);

  const submit = form.handleSubmit(
    (input) => onSubmit(input, form),
    () => toast.error('Please fix the highlighted fields'),
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-8 pb-4">
      <section aria-labelledby="details-heading" className="space-y-4">
        <h3 id="details-heading" className="font-semibold">
          Details
        </h3>
        <FormField id="product-name" label="Name" error={errors.name?.message}>
          <Input {...fieldAria('product-name', errors.name?.message)} {...register('name')} />
        </FormField>
        <FormField
          id="product-description"
          label="Description"
          error={errors.description?.message}
          hint="Optional"
        >
          <Textarea
            {...fieldAria('product-description', errors.description?.message, true)}
            rows={4}
            {...register('description')}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="product-brand"
            label="Brand"
            error={errors.brandId?.message}
            hint={
              brands.length === 0 && (
                <Link to="/admin/brands" className="underline">
                  Create a brand first
                </Link>
              )
            }
          >
            <NativeSelect
              {...fieldAria('product-brand', errors.brandId?.message)}
              {...register('brandId')}
            >
              <option value="">Select a brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            id="product-category"
            label="Category"
            error={errors.categoryId?.message}
            hint={
              categories.length === 0 && (
                <Link to="/admin/categories" className="underline">
                  Create a category first
                </Link>
              )
            }
          >
            <NativeSelect
              {...fieldAria('product-category', errors.categoryId?.message)}
              {...register('categoryId')}
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
      </section>

      <section aria-labelledby="images-heading" className="space-y-4">
        <h3 id="images-heading" className="font-semibold">
          Images
        </h3>
        <Controller
          control={control}
          name="images"
          render={({ field, fieldState }) => (
            <ImagesField
              value={field.value ?? []}
              onChange={(urls) => field.onChange(urls)}
              max={MAX_IMAGES_PER_PRODUCT}
              error={fieldState.error?.message ?? errors.images?.[0]?.message}
            />
          )}
        />
      </section>

      <section aria-labelledby="tiers-heading" className="space-y-4">
        <div className="space-y-1">
          <h3 id="tiers-heading" className="font-semibold">
            Pricing tiers
          </h3>
          <p className="text-sm text-muted-foreground">
            Each tier is a bundle: the price is the <strong>total</strong> for all its units. Add as
            many tiers as you need; the order here is the order shoppers see.
          </p>
        </div>
        <TiersField control={control} register={register} errors={errors} />
      </section>

      {errors.root && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {errors.root.message}
        </p>
      )}

      <div className="sticky bottom-0 z-20 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <Button asChild variant="outline">
          <Link to="/admin/products">Cancel</Link>
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
