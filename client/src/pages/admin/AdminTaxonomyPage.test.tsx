// @vitest-environment jsdom
import type { TaxonomyDto } from '@ncg/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { brands, categories, json } from '@/test/fixtures';
import { mockApi, route } from '@/test/mockApi';
import { renderRoutes } from '@/test/renderRoute';
import { AdminTaxonomyPage } from './AdminTaxonomyPage';

const renderBrands = () =>
  renderRoutes(
    [{ path: '/admin/brands', element: <AdminTaxonomyPage kind="brands" /> }],
    '/admin/brands',
  );

describe('AdminTaxonomyPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists brands with product counts', async () => {
    mockApi(
      route('GET', '/api/brands', () => json(brands)),
      route('GET', '/api/categories', () => json(categories)),
    );
    renderBrands();
    const rows = await screen.findAllByRole('row');
    expect(
      rows.slice(1).map((r) =>
        within(r)
          .getAllByRole('cell')
          .slice(0, 2)
          .map((c) => c.textContent),
      ),
    ).toEqual([
      ['MediCare', '2'],
      ['PharmaPlus', '0'],
    ]);
  });

  it('creates a brand and refreshes the list', async () => {
    const user = userEvent.setup();
    let list: TaxonomyDto[] = [...brands];
    const { calls } = mockApi(
      route('GET', '/api/brands', () => json(list)),
      route('GET', '/api/categories', () => json(categories)),
      route('POST', '/api/admin/brands', ({ body }) => {
        const created = {
          id: 'new-id',
          name: (body as { name: string }).name,
          productCount: 0,
          createdAt: '',
        };
        list = [...list, created];
        return json(created, 201);
      }),
    );
    renderBrands();
    await user.click(await screen.findByRole('button', { name: 'New brand' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), '  CarePlus  ');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('cell', { name: 'CarePlus' })).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'CarePlus' }); // trimmed by zod
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('validates on the client before calling the API', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(
      route('GET', '/api/brands', () => json(brands)),
      route('GET', '/api/categories', () => json(categories)),
    );
    renderBrands();
    await user.click(await screen.findByRole('button', { name: 'New brand' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save' }),
    );
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('shows the API 409 for a duplicate name under the field', async () => {
    const user = userEvent.setup();
    mockApi(
      route('GET', '/api/brands', () => json(brands)),
      route('GET', '/api/categories', () => json(categories)),
      route('PATCH', /\/api\/admin\/brands\//, () =>
        json(
          {
            error: {
              code: 'DUPLICATE_NAME',
              message: 'A brand named "medicare" already exists.',
              details: [{ path: 'name', message: 'A brand with this name already exists' }],
            },
          },
          409,
        ),
      ),
    );
    renderBrands();
    await user.click(await screen.findByRole('button', { name: 'Rename PharmaPlus' }));
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText('Name');
    expect(input).toHaveValue('PharmaPlus');
    await user.clear(input);
    await user.type(input, 'medicare');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(
      await within(dialog).findByText('A brand with this name already exists'),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the API 409 when deleting a brand in use, and keeps the dialog open', async () => {
    const user = userEvent.setup();
    mockApi(
      route('GET', '/api/brands', () => json(brands)),
      route('GET', '/api/categories', () => json(categories)),
      route('DELETE', /\/api\/admin\/brands\//, () =>
        json(
          {
            error: {
              code: 'IN_USE',
              message: 'Cannot delete: 2 products use this brand. Reassign them first.',
              details: { productCount: 2 },
            },
          },
          409,
        ),
      ),
    );
    renderBrands();
    await user.click(await screen.findByRole('button', { name: 'Delete MediCare' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('It is used by 2 products');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Cannot delete: 2 products use this brand. Reassign them first.',
    );
  });

  it('deletes an unused brand after confirming', async () => {
    const user = userEvent.setup();
    let list = [...brands];
    mockApi(
      route('GET', '/api/brands', () => json(list)),
      route('GET', '/api/categories', () => json(categories)),
      route('DELETE', /\/api\/admin\/brands\//, () => {
        list = list.filter((b) => b.name !== 'PharmaPlus');
        return new Response(null, { status: 204 });
      }),
    );
    renderBrands();
    await user.click(await screen.findByRole('button', { name: 'Delete PharmaPlus' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await vi.waitFor(() =>
      expect(screen.queryByRole('cell', { name: 'PharmaPlus' })).not.toBeInTheDocument(),
    );
  });
});
