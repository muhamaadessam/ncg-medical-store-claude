import { Outlet } from 'react-router-dom';
import { SiteHeader } from './SiteHeader';

export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        NCG Pharmacy · Technical assessment demo
      </footer>
    </div>
  );
}
