import { NavLink, Outlet } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/brands', label: 'Brands' },
  { to: '/admin/categories', label: 'Categories' },
];

export function AdminLayout() {
  return (
    <div className="space-y-6">
      <div
        role="note"
        className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>
          <strong>Demo admin, no authentication.</strong> Anyone with the link can change the
          catalog (authentication is out of scope for this assessment).
        </p>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <nav aria-label="Admin sections" className="-mx-4 overflow-x-auto px-4">
          <ul className="flex gap-1 border-b">
            {TABS.map((tab) => (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  className={({ isActive }) =>
                    cn(
                      '-mb-px inline-flex h-11 items-center border-b-2 px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  {tab.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <Outlet />
    </div>
  );
}
