import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { brandInputSchema, type BrandInput, type TaxonomyDto } from '@ncg/shared';
import { fieldAria, FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api';
import { applyServerErrors, useSaveTaxonomy, type TaxonomyKind } from '../api';

export const TAXONOMY_LABELS = {
  brands: { one: 'brand', One: 'Brand', many: 'brands', Many: 'Brands' },
  categories: { one: 'category', One: 'Category', many: 'categories', Many: 'Categories' },
} as const;

/** Create (item undefined) or rename a brand / category. */
export function TaxonomyDialog({
  kind,
  open,
  onOpenChange,
  item,
}: {
  kind: TaxonomyKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: TaxonomyDto;
}) {
  const labels = TAXONOMY_LABELS[kind];
  const save = useSaveTaxonomy(kind);
  // brand and category inputs share the same schema shape ({ name })
  const form = useForm<BrandInput>({
    resolver: zodResolver(brandInputSchema),
    defaultValues: { name: item?.name ?? '' },
  });
  const { reset } = form;

  useEffect(() => {
    if (open) reset({ name: item?.name ?? '' });
  }, [open, item, reset]);

  const onSubmit = form.handleSubmit(async ({ name }) => {
    try {
      await save.mutateAsync({ id: item?.id, name });
      toast.success(item ? `${labels.One} renamed` : `${labels.One} created`, {
        description: name,
      });
      onOpenChange(false);
    } catch (err) {
      // 409 duplicate name / 400 validation come back with field details for "name".
      if (!applyServerErrors(err, form.setError, (p) => p === 'name')) {
        form.setError('root', { message: errorMessage(err) });
      }
    }
  });

  const nameError = form.formState.errors.name?.message;
  const fieldId = `${kind}-name`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{item ? `Rename ${labels.one}` : `New ${labels.one}`}</DialogTitle>
            <DialogDescription>
              {item
                ? `Products using "${item.name}" will show the new name.`
                : `Names must be unique (case-insensitive).`}
            </DialogDescription>
          </DialogHeader>
          <FormField id={fieldId} label="Name" error={nameError}>
            <Input
              {...fieldAria(fieldId, nameError)}
              autoComplete="off"
              autoFocus
              {...form.register('name')}
            />
          </FormField>
          {form.formState.errors.root && (
            <p role="alert" className="text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
