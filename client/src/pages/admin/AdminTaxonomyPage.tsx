import { useState } from 'react';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { TaxonomyDto } from '@ncg/shared';
import { EmptyState, ErrorState } from '@/components/StatusViews';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteTaxonomy, type TaxonomyKind } from '@/features/admin/api';
import { ConfirmDeleteDialog } from '@/features/admin/components/ConfirmDeleteDialog';
import { TAXONOMY_LABELS, TaxonomyDialog } from '@/features/admin/components/TaxonomyDialog';
import { useBrands, useCategories } from '@/features/catalog/api';
import { usePageTitle } from '@/lib/usePageTitle';

const productsText = (n: number) => `${n} ${n === 1 ? 'product' : 'products'}`;

export function AdminTaxonomyPage({ kind }: { kind: TaxonomyKind }) {
  const labels = TAXONOMY_LABELS[kind];
  usePageTitle(`Admin · ${labels.Many}`);
  const brands = useBrands();
  const categories = useCategories();
  const query = kind === 'brands' ? brands : categories;
  const remove = useDeleteTaxonomy(kind);

  const [editing, setEditing] = useState<TaxonomyDto | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<TaxonomyDto | undefined>();

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };
  const openRename = (item: TaxonomyDto) => {
    setEditing(item);
    setDialogOpen(true);
  };

  return (
    <section aria-labelledby="taxonomy-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="taxonomy-heading" className="text-lg font-semibold">
          {labels.Many}
        </h2>
        <Button onClick={openCreate}>
          <Plus aria-hidden />
          New {labels.one}
        </Button>
      </div>

      {query.isPending ? (
        <div className="space-y-2" role="status" aria-label={`Loading ${labels.many}`}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState
          title={`We couldn't load the ${labels.many}`}
          error={query.error}
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.data.length === 0 ? (
        <EmptyState
          icon={<Tags aria-hidden className="size-10 text-muted-foreground" />}
          title={`No ${labels.many} yet`}
          description={`Create a ${labels.one} to use it on products.`}
          action={<Button onClick={openCreate}>New {labels.one}</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Products
                </th>
                <th scope="col" className="w-0 px-4 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {query.data.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2 font-medium">{item.name}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
                    {item.productCount}
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openRename(item)}
                        aria-label={`Rename ${item.name}`}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting(item)}
                        aria-label={`Delete ${item.name}`}
                        className="hover:text-destructive"
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TaxonomyDialog kind={kind} open={dialogOpen} onOpenChange={setDialogOpen} item={editing} />

      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={`Delete ${labels.one} "${deleting?.name ?? ''}"?`}
        description={
          deleting && deleting.productCount > 0
            ? `It is used by ${productsText(deleting.productCount)}. Reassign ${deleting.productCount === 1 ? 'it' : 'them'} first, or the delete will be refused.`
            : 'This cannot be undone.'
        }
        onConfirm={async () => {
          if (!deleting) return;
          await remove.mutateAsync(deleting);
          toast.success(`${labels.One} deleted`, { description: deleting.name });
        }}
      />
    </section>
  );
}
