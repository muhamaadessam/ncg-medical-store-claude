// @vitest-environment jsdom
import type { ProductDto } from '@ncg/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cartStore } from '@/features/cart/cartStore';
import { CHECKOUT_DISABLED_REASON } from '@/features/cart/components/CartSummary';
import { OFFER_GONE_MESSAGE } from '@/features/cart/useCartView';
import { json, thermometer, vitaminD } from '@/test/fixtures';
import { CartPage } from './CartPage';

/** Serve products by id; anything not in `catalog` is a 404 (deleted product). */
function mockCatalog(catalog: Record<string, ProductDto | 'error'>) {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const id = new URL(String(input), 'http://localhost').pathname.split('/').pop()!;
    const entry = catalog[id];
    if (entry === 'error')
      return json({ error: { code: 'INTERNAL_ERROR', message: 'Database is down' } }, 500);
    if (!entry) return json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
    return json(entry);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function renderCart() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

const items = () =>
  within(screen.getByRole('list', { name: 'Cart items' })).getAllByRole('listitem');
const summary = () =>
  within(screen.getByRole('region', { name: 'Order summary' }))
    .getAllByRole('definition')
    .map((dd) => dd.textContent);

const add = (tierId: string, productId: string, bundles: number) =>
  cartStore.add({ tierId, productId }, bundles);

describe('CartPage', () => {
  beforeEach(() => cartStore.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('shows the empty state', () => {
    mockCatalog({});
    renderCart();
    expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse products' })).toHaveAttribute('href', '/');
  });

  it("brief example: 2 × '4 Packs' = 8 packs = 39.000 KWD", async () => {
    mockCatalog({ [vitaminD.id]: vitaminD });
    add('tier-4', vitaminD.id, 2);
    renderCart();
    const [line] = await screen.findAllByRole('listitem');
    expect(line).toHaveTextContent('2 × 4 Packs = 8 packs');
    expect(line).toHaveTextContent('19.500 KWD'); // bundle price
    expect(line).toHaveTextContent('39.000 KWD'); // line total
    expect(summary()).toEqual(['2', '8', '39.000 KWD']);
  });

  it('C: 1×1 + 2×4 + 1×12 → 3 lines, 99.500 KWD, 21 packs', async () => {
    mockCatalog({ [vitaminD.id]: vitaminD });
    add('tier-1', vitaminD.id, 1);
    add('tier-4', vitaminD.id, 2);
    add('tier-12', vitaminD.id, 1);
    renderCart();
    await screen.findByRole('list', { name: 'Cart items' });
    expect(items()).toHaveLength(3); // different tiers of one product = separate lines
    expect(summary()).toEqual(['4', '21', '99.500 KWD']);
    expect(screen.getByText('3 items')).toBeInTheDocument();
  });

  it('updates totals when bundles change, clamped to 1–99', async () => {
    const user = userEvent.setup();
    mockCatalog({ [vitaminD.id]: vitaminD });
    add('tier-4', vitaminD.id, 2);
    renderCart();
    await user.click(
      await screen.findByRole('button', { name: `Increase bundles for 4 Packs, ${vitaminD.name}` }),
    );
    expect(summary()).toEqual(['3', '12', '58.500 KWD']);

    const input = screen.getByRole('textbox', { name: `Bundles for 4 Packs, ${vitaminD.name}` });
    await user.clear(input);
    await user.type(input, '500');
    await user.tab();
    expect(cartStore.getLines()[0]!.bundles).toBe(99);
    expect(summary()).toEqual(['99', '396', '1,930.500 KWD']);
  });

  it('removes a line, with Undo', async () => {
    const user = userEvent.setup();
    mockCatalog({ [vitaminD.id]: vitaminD, [thermometer.id]: thermometer });
    add('tier-4', vitaminD.id, 2);
    add('thermo-1', thermometer.id, 1);
    renderCart();
    await user.click(
      await screen.findByRole('button', { name: `Remove 4 Packs, ${vitaminD.name}` }),
    );
    expect(cartStore.getLines()).toEqual([
      { tierId: 'thermo-1', productId: thermometer.id, bundles: 1 },
    ]);
    expect(items()).toHaveLength(1);

    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(cartStore.getLines()).toContainEqual({
      tierId: 'tier-4',
      productId: vitaminD.id,
      bundles: 2,
    });
  });

  it('drops an offer deleted in the admin and tells the user', async () => {
    const withoutFour = { ...vitaminD, tiers: vitaminD.tiers.filter((t) => t.id !== 'tier-4') };
    mockCatalog({ [vitaminD.id]: withoutFour });
    add('tier-4', vitaminD.id, 2);
    add('tier-1', vitaminD.id, 1);
    renderCart();
    expect(await screen.findByText(OFFER_GONE_MESSAGE)).toBeInTheDocument();
    expect(cartStore.getLines()).toEqual([
      { tierId: 'tier-1', productId: vitaminD.id, bundles: 1 },
    ]);
    expect(items()).toHaveLength(1);
  });

  it('drops lines of a deleted product (404)', async () => {
    mockCatalog({ [thermometer.id]: thermometer });
    add('tier-4', vitaminD.id, 2);
    add('thermo-1', thermometer.id, 1);
    renderCart();
    expect(await screen.findByText(OFFER_GONE_MESSAGE)).toBeInTheDocument();
    expect(cartStore.getLines().map((l) => l.tierId)).toEqual(['thermo-1']);
  });

  it('keeps the cart on a network/server error and offers Retry', async () => {
    const user = userEvent.setup();
    const catalog: Record<string, ProductDto | 'error'> = { [vitaminD.id]: 'error' };
    mockCatalog(catalog);
    add('tier-4', vitaminD.id, 2);
    renderCart();
    expect(await screen.findByRole('alert')).toHaveTextContent('Database is down');
    expect(cartStore.getLines()).toHaveLength(1); // nothing dropped

    catalog[vitaminD.id] = vitaminD;
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByRole('list', { name: 'Cart items' })).toBeInTheDocument();
  });

  it('has a disabled Checkout explaining it is out of scope', async () => {
    const user = userEvent.setup();
    mockCatalog({ [vitaminD.id]: vitaminD });
    add('tier-4', vitaminD.id, 1);
    renderCart();
    const checkout = await screen.findByRole('button', { name: 'Checkout' });
    expect(checkout).toHaveAttribute('aria-disabled', 'true');
    expect(checkout).toHaveAccessibleDescription(CHECKOUT_DISABLED_REASON);
    await user.click(checkout);
    expect(cartStore.getLines()).toHaveLength(1);
  });

  it('clears the cart with Undo', async () => {
    const user = userEvent.setup();
    mockCatalog({ [vitaminD.id]: vitaminD });
    add('tier-4', vitaminD.id, 2);
    add('tier-1', vitaminD.id, 1);
    renderCart();
    await user.click(await screen.findByRole('button', { name: 'Clear cart' }));
    expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(cartStore.getLines()).toHaveLength(2);
  });
});
