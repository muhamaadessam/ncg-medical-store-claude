// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cartStore } from '@/features/cart/cartStore';
import { brands, categories, json, MEDICARE, thermometer, vitaminD } from '@/test/fixtures';
import { HomePage } from './HomePage';

type Handler = (url: URL) => Response | Promise<Response>;

function mockApi(products: Handler) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/brands') return json(brands);
    if (url.pathname === '/api/categories') return json(categories);
    if (url.pathname === '/api/products') return products(url);
    return json({ error: { code: 'NOT_FOUND', message: 'nope' } }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderHome(path = '/') {
  const router = createMemoryRouter([{ path: '/', element: <HomePage /> }], {
    initialEntries: [path],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );
  return router;
}

describe('HomePage', () => {
  beforeEach(() => cartStore.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('shows skeletons, then the products', async () => {
    mockApi(() => json([thermometer, vitaminD]));
    renderHome();
    expect(screen.getByRole('status', { name: /loading products/i })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: vitaminD.name })).toBeInTheDocument();
    expect(screen.getByText('2 products')).toBeInTheDocument();
  });

  it('filters through the URL and sends the filter to the API', async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi((url) =>
      json(url.searchParams.get('brandId') === MEDICARE ? [vitaminD] : [thermometer, vitaminD]),
    );
    const router = renderHome();
    await screen.findByText('2 products');

    // Desktop sidebar is hidden with CSS only, so both lists exist in the DOM.
    const [brandButton] = screen.getAllByRole('button', { name: /^MediCare/ });
    await user.click(brandButton!);

    await screen.findByText('1 product');
    expect(router.state.location.search).toBe(`?brand=${MEDICARE}`);
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes(`brandId=${MEDICARE}`)),
    ).toBe(true);
    expect(screen.getAllByRole('button', { name: /^MediCare/ })[0]).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('ignores malformed filter ids in the URL', async () => {
    const fetchMock = mockApi(() => json([vitaminD]));
    renderHome('/?brand=not-a-uuid');
    await screen.findByText('1 product');
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain('/api/products');
  });

  it('shows an empty state with Clear filters', async () => {
    const user = userEvent.setup();
    mockApi((url) => json(url.searchParams.has('brandId') ? [] : [vitaminD]));
    const router = renderHome(`/?brand=${MEDICARE}`);
    expect(await screen.findByText('No products match these filters')).toBeInTheDocument();
    // Sidebar, mobile bar and empty state each offer it; use the empty state's button.
    const buttons = screen.getAllByRole('button', { name: 'Clear filters' });
    await user.click(buttons[buttons.length - 1]!);
    await screen.findByText('1 product');
    expect(router.state.location.search).toBe('');
  });

  it('shows an error with Retry', async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi(() =>
      fail
        ? json({ error: { code: 'INTERNAL_ERROR', message: 'Database is down' } }, 500)
        : json([vitaminD]),
    );
    renderHome();
    expect(await screen.findByRole('alert')).toHaveTextContent('Database is down');
    fail = false;
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('1 product')).toBeInTheDocument();
  });

  it('adds one bundle of the selected tier to the cart and confirms', async () => {
    const user = userEvent.setup();
    mockApi(() => json([vitaminD]));
    renderHome();
    await user.click(await screen.findByRole('radio', { name: /4 Packs/ }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(cartStore.getLines()).toEqual([
      { tierId: 'tier-4', productId: vitaminD.id, bundles: 2 },
    ]);
    await waitFor(() => expect(screen.getAllByText('Added to cart').length).toBeGreaterThan(0));
  });
});
