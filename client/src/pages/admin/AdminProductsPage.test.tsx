// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, thermometer, vitaminD } from '@/test/fixtures';
import { mockApi, route } from '@/test/mockApi';
import { renderRoutes } from '@/test/renderRoute';
import { AdminProductsPage } from './AdminProductsPage';

const renderPage = () =>
  renderRoutes([{ path: '/admin/products', element: <AdminProductsPage /> }], '/admin/products');

// Desktop table and mobile cards are both in the DOM (CSS picks one): use the table.
const tableRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('AdminProductsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows name, brand, category, tier count and price range', async () => {
    mockApi(route('GET', '/api/products', () => json([thermometer, vitaminD])));
    renderPage();
    await screen.findByRole('table');
    const [, vitRow] = tableRows();
    const cells = within(vitRow!)
      .getAllByRole('cell')
      .map((c) => c.textContent);
    expect(cells.slice(1, 6)).toEqual([
      vitaminD.name,
      'MediCare',
      'Vitamins & Supplements',
      '3',
      '5.500 – 55.000 KWD',
    ]);
  });

  it('searches by name, brand or category', async () => {
    const user = userEvent.setup();
    mockApi(route('GET', '/api/products', () => json([thermometer, vitaminD])));
    renderPage();
    await screen.findByRole('table');
    await user.type(screen.getByRole('searchbox', { name: 'Search products' }), 'first aid');
    expect(tableRows()).toHaveLength(1);
    expect(tableRows()[0]).toHaveTextContent('Digital Thermometer');
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('No products match "zzz"')).toBeInTheDocument();
  });

  it('deletes a product after confirming', async () => {
    const user = userEvent.setup();
    let list = [thermometer, vitaminD];
    const { calls } = mockApi(
      route('GET', '/api/products', () => json(list)),
      route('DELETE', `/api/admin/products/${vitaminD.id}`, () => {
        list = [thermometer];
        return new Response(null, { status: 204 });
      }),
    );
    renderPage();
    await screen.findByRole('table');
    await user.click(
      within(tableRows()[1]!).getByRole('button', { name: `Delete ${vitaminD.name}` }),
    );
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await vi.waitFor(() => expect(tableRows()).toHaveLength(1));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
  });

  it('shows an empty state with a create link', async () => {
    mockApi(route('GET', '/api/products', () => json([])));
    renderPage();
    expect(await screen.findByText('No products yet')).toBeInTheDocument();
  });
});
