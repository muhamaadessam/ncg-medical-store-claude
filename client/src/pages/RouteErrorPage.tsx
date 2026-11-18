import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePageTitle } from '@/lib/usePageTitle';
import { NotFoundPage } from './NotFoundPage';

/** After a deploy, an open tab may ask for a code chunk that no longer exists. */
function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|Loading chunk/i.test(
    message,
  );
}

/** Root error boundary for every route (render errors, lazy-load failures, unknown routes). */
export function RouteErrorPage() {
  const error = useRouteError();
  usePageTitle('Something went wrong');

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  const chunk = isChunkLoadError(error);
  if (import.meta.env.DEV) console.error(error);

  return (
    <section
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center"
    >
      <AlertTriangle aria-hidden className="size-10 text-destructive" />
      <h1 className="text-2xl font-semibold">
        {chunk ? 'A new version is available' : 'Something went wrong'}
      </h1>
      <p className="text-muted-foreground">
        {chunk
          ? 'The site was updated while this page was open. Reload to get the latest version.'
          : 'An unexpected error stopped this page from loading. Your cart is safe.'}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => window.location.reload()}>
          <RotateCw aria-hidden />
          Reload
        </Button>
        <Button asChild variant="outline">
          <Link to="/" reloadDocument>
            Go to the shop
          </Link>
        </Button>
      </div>
    </section>
  );
}
