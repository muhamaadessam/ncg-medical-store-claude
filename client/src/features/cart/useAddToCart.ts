import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MAX_BUNDLES } from './cartLogic';
import { cartStore } from './cartStore';

/** Add bundles of one tier to the cart and confirm with a toast. */
export function useAddToCart() {
  const navigate = useNavigate();
  return useCallback(
    (
      item: { productId: string; productName: string; tierId: string; tierLabel: string },
      bundles = 1,
    ) => {
      const result = cartStore.add({ tierId: item.tierId, productId: item.productId }, bundles);
      const action = { label: 'View cart', onClick: () => navigate('/cart') };
      if (result.capped) {
        toast.warning(`Maximum ${MAX_BUNDLES} bundles per offer`, {
          description: `${item.productName} · ${item.tierLabel} is now at ${result.bundles}.`,
          action,
        });
        return result;
      }
      toast.success('Added to cart', {
        description: `${bundles} × ${item.tierLabel} · ${item.productName}`,
        action,
      });
      return result;
    },
    [navigate],
  );
}
