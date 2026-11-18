import type { ReactNode } from 'react';
import { AlertTriangle, PackageSearch, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

export function ErrorState({
  title = 'Something went wrong',
  error,
  onRetry,
  retrying,
  className,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center',
        className,
      )}
    >
      <AlertTriangle aria-hidden className="size-8 text-destructive" />
      <div className="space-y-1">
        <h2 className="font-semibold">{title}</h2>
        {error !== undefined && (
          <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          <RotateCw aria-hidden className={cn(retrying && 'animate-spin')} />
          {retrying ? 'Retrying…' : 'Retry'}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center',
        className,
      )}
    >
      {icon ?? <PackageSearch aria-hidden className="size-10 text-muted-foreground" />}
      <div className="space-y-1">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
