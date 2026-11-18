import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, ErrorState } from '@/components/StatusViews';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CartLineItem, CartTableHeader } from '@/features/cart/components/CartLineItem';
import { CartSummary } from '@/features/cart/components/CartSummary';
import { cartStore } from '@/features/cart/cartStore';
import type { CartItem } from '@/features/cart/reconcile';
import { useCartView } from '@/features/cart/useCartView';
import { usePageTitle } from '@/lib/usePageTitle';

export function CartPage() {
  usePageTitle('Cart');
  const cart = useCartView();

  if (cart.lines.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Your cart</h1>
        <EmptyState
          icon={<ShoppingCart aria-hidden className="size-10 text-muted-foreground" />}
          title="Your cart is empty"
          description="Pick a bundle on any product to add it here."
          action={
            <Button asChild>
              <Link to="/">Browse products</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (cart.error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Your cart</h1>
        <ErrorState
          title="We couldn't load your cart"
          error={cart.error}
          onRetry={cart.retry}
          retrying={cart.isRetrying}
        />
      </div>
    );
  }

  if (cart.isLoading) return <CartSkeleton lines={cart.lines.length} />;

  const remove = (item: CartItem) => {
    cartStore.remove(item.tierId);
    toast(`Removed ${item.tier.label} · ${item.product.name}`, {
      action: {
        label: 'Undo',
        onClick: () =>
          cartStore.add({ tierId: item.tierId, productId: item.productId }, item.bundles),
      },
    });
  };

  const clear = () => {
    const snapshot = cartStore.getLines();
    cartStore.clear();
    toast('Cart cleared', {
      action: { label: 'Undo', onClick: () => cartStore.restore(snapshot) },
    });
  };

  const count = cart.items.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Your cart</h1>
          <p className="text-sm text-muted-foreground">
            {count} {count === 1 ? 'item' : 'items'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={clear}>
          Clear cart
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="rounded-xl border bg-card px-4 shadow-xs lg:px-5 lg:pt-4">
          <CartTableHeader />
          <ul className="divide-y" aria-label="Cart items">
            {cart.items.map((item) => (
              <CartLineItem
                key={item.tierId}
                item={item}
                onBundlesChange={(n) => cartStore.setBundles(item.tierId, n)}
                onRemove={() => remove(item)}
              />
            ))}
          </ul>
        </div>
        <div className="w-full md:ml-auto md:max-w-sm xl:sticky xl:top-22 xl:max-w-none">
          <CartSummary totals={cart.totals} />
        </div>
      </div>
    </div>
  );
}

function CartSkeleton({ lines }: { lines: number }) {
  return (
    <div className="space-y-6" role="status" aria-label="Loading cart">
      <Skeleton className="h-8 w-40" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4 rounded-xl border p-4">
          {Array.from({ length: Math.min(lines, 4) }, (_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-18 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-32" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    </div>
  );
}
