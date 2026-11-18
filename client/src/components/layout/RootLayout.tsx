import { Outlet, ScrollRestoration, useNavigation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SiteHeader } from './SiteHeader';

export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <NavigationProgress />
      <SiteHeader />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none"
      >
        <Outlet />
      </main>
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        NCG Pharmacy · Technical assessment demo
      </footer>
      <ScrollRestoration />
    </div>
  );
}

/** Thin bar at the top while a lazily loaded page (the admin) is being fetched. */
function NavigationProgress() {
  const loading = useNavigation().state === 'loading';
  return (
    <div
      role="progressbar"
      aria-hidden={!loading}
      aria-label="Loading page"
      className={cn(
        'fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-primary transition-transform duration-500',
        loading ? 'scale-x-75' : 'scale-x-0 opacity-0',
      )}
    />
  );
}
