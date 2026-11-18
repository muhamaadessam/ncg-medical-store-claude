import type { TaxonomyDto } from '@ncg/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface FilterGroupProps {
  title: string;
  query: UseQueryResult<TaxonomyDto[]>;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
}

/** Desktop sidebar group: a vertical list of toggle buttons with product counts. */
export function FilterList({ title, query, selectedId, onSelect }: FilterGroupProps) {
  const headingId = `filter-${title.toLowerCase()}`;
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h2
        id={headingId}
        className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        {title}
      </h2>
      {query.isPending ? (
        <div className="space-y-1">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <FilterError title={title} onRetry={() => query.refetch()} />
      ) : (
        <ul className="space-y-1">
          <li>
            <FilterButton active={!selectedId} onClick={() => onSelect(undefined)} label="All" />
          </li>
          {query.data.map((item) => (
            <li key={item.id}>
              <FilterButton
                active={item.id === selectedId}
                onClick={() => onSelect(item.id === selectedId ? undefined : item.id)}
                label={item.name}
                count={item.productCount}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        active ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-accent',
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      {count !== undefined && (
        <span
          className="text-xs text-muted-foreground tabular-nums"
          aria-label={`${count} products`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/** Mobile / tablet: one horizontally scrollable row of chips per group. */
export function FilterChips({ title, query, selectedId, onSelect }: FilterGroupProps) {
  return (
    <div role="group" aria-label={title} className="flex items-center gap-2">
      <span className="w-18 shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </span>
      {query.isError ? (
        <FilterError title={title} onRetry={() => query.refetch()} />
      ) : (
        <div className="-mr-4 flex min-w-0 flex-1 [scrollbar-width:none] gap-2 overflow-x-auto pr-4 pb-1 [&::-webkit-scrollbar]:hidden">
          {query.isPending ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-24 shrink-0 rounded-full" />)
          ) : (
            <>
              <Chip active={!selectedId} onClick={() => onSelect(undefined)} label="All" />
              {query.data.map((item) => (
                <Chip
                  key={item.id}
                  active={item.id === selectedId}
                  onClick={() => onSelect(item.id === selectedId ? undefined : item.id)}
                  label={item.name}
                  count={item.productCount}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'bg-background hover:bg-accent',
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn('text-xs tabular-nums', active ? 'opacity-80' : 'text-muted-foreground')}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function FilterError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>{title} unavailable.</span>
      <Button variant="link" size="sm" className="h-auto px-0" onClick={onRetry}>
        <RotateCw aria-hidden />
        Retry
      </Button>
    </div>
  );
}

export function ClearFiltersButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className={className}>
      <X aria-hidden />
      Clear filters
    </Button>
  );
}
