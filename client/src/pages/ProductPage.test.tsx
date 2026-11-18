// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cartStore } from '@/features/cart/cartStore';
import { json, thermometer, vitaminD } from '@/test/fixtures';
import { ProductPage } from './ProductPage';

const withGallery = {
  ...vitaminD,
  description: 'Daily vitamin D3.',
  images: [
    { id: 'i1', url: '/uploads/a.jpg', sortOrder: 0 },
    { id: 'i2', url: '/uploads/b.jpg', sortOrder: 1 },
  ],
};

function mockFetch(handler: (path: string) => Response) {
  const fn = vi.fn(async (input: RequestInfo | URL) =>
    handler(new URL(String(input), 'http://localhost').pathname),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>home page</p> },
      { path: '/products/:id', element: <ProductPage /> },
    ],
    { initialEntries: [path] },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

/** The summary list (dt/dd pairs) as plain text rows. */
const summaryRows = () =>
  within(screen.getAllByRole('definition')[0]!.closest('dl')!)
    .getAllByRole('definition')
    .map((dd) => dd.textContent);

describe('ProductPage', () => {
  beforeEach(() => cartStore.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('shows a skeleton, then the product details', async () => {
    mockFetch(() => json(withGallery));
    renderAt(`/products/${vitaminD.id}`);
    expect(screen.getByRole('status', { name: /loading product/i })).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: vitaminD.name }),
    ).toBeInTheDocument();
    expect(screen.getByText('Daily vitamin D3.')).toBeInTheDocument();
    expect(document.title).toBe(`${vitaminD.name} · NCG Pharmacy`);
  });

  it('links brand and category to the filtered home page', async () => {
    mockFetch(() => json(withGallery));
    renderAt(`/products/${vitaminD.id}`);
    expect(await screen.findByRole('link', { name: 'MediCare' })).toHaveAttribute(
      'href',
      `/?brand=${vitaminD.brand.id}`,
    );
    expect(screen.getByRole('link', { name: 'Vitamins & Supplements' })).toHaveAttribute(
      'href',
      `/?category=${vitaminD.category.id}`,
    );
  });

  it('live summary: 2 × 4 Packs · Total packs: 8 · Total: 39.000 KWD', async () => {
    const user = userEvent.setup();
    mockFetch(() => json(withGallery));
    renderAt(`/products/${vitaminD.id}`);

    await user.click(await screen.findByRole('radio', { name: /4 Packs/ }));
    await user.click(screen.getByRole('button', { name: 'Increase bundles' }));

    expect(summaryRows()).toEqual(['2 × 4 Packs', '8', '39.000 KWD']);
    expect(screen.getByText('Total packs')).toBeInTheDocument();
  });

  it('adds (tierId, bundles) to the cart', async () => {
    const user = userEvent.setup();
    mockFetch(() => json(withGallery));
    renderAt(`/products/${vitaminD.id}`);

    await user.click(await screen.findByRole('radio', { name: /12 Packs/ }));
    const input = screen.getByRole('textbox', { name: 'Bundles' });
    await user.clear(input);
    await user.type(input, '3');
    // Desktop button and the mobile sticky bar both exist in the DOM (CSS decides which shows).
    await user.click(screen.getAllByRole('button', { name: /add to cart/i })[0]!);

    expect(cartStore.getLines()).toEqual([
      { tierId: 'tier-12', productId: vitaminD.id, bundles: 3 },
    ]);
  });

  it.each(['2.5', '-5', '1e2', 'abc', '0', '150', '500', ''])(
    'rejects %j on the product page: summary stays at 2 × 4 Packs, field restored on blur',
    async (text) => {
      const user = userEvent.setup();
      mockFetch(() => json(withGallery));
      renderAt(`/products/${vitaminD.id}`);
      await user.click(await screen.findByRole('radio', { name: /4 Packs/ }));
      await user.click(screen.getByRole('button', { name: 'Increase bundles' }));
      const input = screen.getByRole('textbox', { name: 'Bundles' });

      await user.clear(input);
      if (text) await user.type(input, text);
      expect(input).toHaveValue(text);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      // No intermediate number (e.g. "50 × 4 Packs" while typing "500", or 25 for "2.5").
      expect(summaryRows()).toEqual(['2 × 4 Packs', '8', '39.000 KWD']);

      await user.tab();
      expect(input).toHaveValue('2');
      await user.click(screen.getAllByRole('button', { name: /add to cart/i })[0]!);
      expect(cartStore.getLines()).toEqual([
        { tierId: 'tier-4', productId: vitaminD.id, bundles: 2 },
      ]);
    },
  );

  it('shows a plain price for a single-tier product', async () => {
    mockFetch(() => json(thermometer));
    renderAt(`/products/${thermometer.id}`);
    expect(await screen.findByRole('heading', { name: 'Price' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(summaryRows()).toEqual(['1 × 1 Pack', '1', '3.750 KWD']);
  });

  it('switches the main image with the thumbnails', async () => {
    const user = userEvent.setup();
    mockFetch(() => json(withGallery));
    renderAt(`/products/${vitaminD.id}`);
    const second = await screen.findByRole('button', { name: 'Show image 2 of 2' });
    await user.click(second);
    expect(second).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('img', { name: `${vitaminD.name}, image 2 of 2` })).toHaveAttribute(
      'src',
      '/uploads/b.jpg',
    );
  });

  it('shows a not-found page for a 404', async () => {
    mockFetch(() => json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404));
    renderAt('/products/missing');
    expect(await screen.findByRole('heading', { name: 'Product not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse products' })).toHaveAttribute('href', '/');
  });

  it('shows an error with Retry for other failures', async () => {
    const user = userEvent.setup();
    let fail = true;
    mockFetch(() =>
      fail
        ? json({ error: { code: 'INTERNAL_ERROR', message: 'Server is busy' } }, 500)
        : json(withGallery),
    );
    renderAt(`/products/${vitaminD.id}`);
    expect(await screen.findByRole('alert')).toHaveTextContent('Server is busy');
    fail = false;
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: vitaminD.name }),
    ).toBeInTheDocument();
  });
});
