import type {
  BrandDto,
  ProductDto,
  ProductInput,
  TaxonomyDto,
  UploadResponse,
  ValidationIssue,
} from '@ncg/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { catalogKeys } from '@/features/catalog/api';
import { ApiError, apiFetch } from '@/lib/api';

export type TaxonomyKind = 'brands' | 'categories';

/** After any admin change, every catalog query (shop, product pages, counts) is refetched. */
function useInvalidateCatalog() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: catalogKeys.all });
}

export function useSaveTaxonomy(kind: TaxonomyKind) {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: ({ id, name }: { id?: string; name: string }) =>
      apiFetch<TaxonomyDto>(id ? `/api/admin/${kind}/${id}` : `/api/admin/${kind}`, {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteTaxonomy(kind: TaxonomyKind) {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (item: Pick<BrandDto, 'id'>) =>
      apiFetch<void>(`/api/admin/${kind}/${item.id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useSaveProduct() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ProductInput }) =>
      apiFetch<ProductDto>(id ? `/api/admin/products/${id}` : '/api/admin/products', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/admin/products/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Client-side pre-check (the server checks again, including the file's real bytes). */
export function imageFileProblem(file: File): string | undefined {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return `${file.name}: only JPEG, PNG, WebP or GIF`;
  if (file.size > MAX_UPLOAD_BYTES) return `${file.name}: larger than 3 MB`;
  return undefined;
}

export function uploadImage(file: File): Promise<UploadResponse> {
  const body = new FormData();
  body.append('image', file);
  return apiFetch<UploadResponse>('/api/admin/uploads', { method: 'POST', body });
}

/**
 * Put server-side validation errors (400 details / 409 field details) on the matching form fields.
 * Returns true when at least one field error was applied.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownPaths: (path: string) => boolean,
): boolean {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return false;
  let applied = false;
  for (const issue of error.details as ValidationIssue[]) {
    if (typeof issue?.path !== 'string' || !knownPaths(issue.path)) continue;
    setError(
      issue.path as Path<T>,
      { type: 'server', message: issue.message },
      { shouldFocus: !applied },
    );
    applied = true;
  }
  return applied;
}
