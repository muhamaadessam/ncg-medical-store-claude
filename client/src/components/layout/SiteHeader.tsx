import { Link, NavLink } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCartLines } from '@/features/cart/cartStore';
import { cn } from '@/lib/utils';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex h-10 min-w-10 items-center justify-center rounded-md px-2 text-sm sm:px-3 font-medium transition-colors hover:bg-accent',
    isActive ? 'text-primary' : 'text-muted-foreground',
  );

export function SiteHeader() {
  const lineCount = useCartLines().length;
  const cartLabel = lineCount
    ? `Cart, ${lineCount} ${lineCount === 1 ? 'item' : 'items'}`
    : 'Cart, empty';
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4">
        <Link to="/" className="flex h-10 items-center gap-2 font-semibold">
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
          <NavLink to="/cart" className={navLinkClass} aria-label={cartLabel}>
            <span className="relative">
              <ShoppingCart aria-hidden className="size-5" />
              {lineCount > 0 && (
                <span
                  aria-hidden
                  className="absolute -top-2 -right-2.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums"
                >
                  {lineCount > 99 ? '99+' : lineCount}
                </span>
              )}
            </span>
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
