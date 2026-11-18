import { Link, NavLink } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex h-10 min-w-10 items-center justify-center rounded-md px-2 text-sm sm:px-3 font-medium transition-colors hover:bg-accent',
    isActive ? 'text-primary' : 'text-muted-foreground',
  );

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <img src="/favicon.svg" alt="" className="size-8" width={32} height={32} />
          <span className="text-base whitespace-nowrap sm:text-lg">NCG Pharmacy</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-0.5 sm:gap-1">
          <NavLink to="/" end className={navLinkClass}>
            Shop
          </NavLink>
          <NavLink to="/admin" className={navLinkClass}>
            Admin
          </NavLink>
          <NavLink to="/cart" className={navLinkClass} aria-label="Cart">
            <ShoppingCart aria-hidden className="size-5" />
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
