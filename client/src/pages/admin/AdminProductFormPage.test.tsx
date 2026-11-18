// @vitest-environment jsdom
import type { ProductInput } from '@ncg/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { brands, categories, FIRST_AID, json, MEDICARE, vitaminD } from '@/test/fixtures';
import { mockApi, route, type Call } from '@/test/mockApi';
import { renderRoutes } from '@/test/renderRoute';
import { AdminProductFormPage } from './AdminProductFormPage';

const base = [
  route('GET', '/api/brands', () => json(brands)),
  route('GET', '/api/categories', () => json(categories)),
];

function renderForm(path: string) {
  return renderRoutes(
    [
      { path: '/admin/products', element: <p>products list</p> },
      { path: '/admin/products/new', element: <AdminProductFormPage /> },
      { path: '/admin/products/:id', element: <AdminProductFormPage /> },
    ],
    path,
  );
}

const tier = (n: number) =>
  within(
    screen.getAllByRole('listitem').filter((li) => li.textContent?.startsWith(`Tier ${n}`))[0]!,
  );

describe('AdminProductFormPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows inline errors and does not call the API when invalid', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(...base);
    renderForm('/admin/products/new');
    await user.click(await screen.findByRole('button', { name: 'Create product' }));

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    // ("Select a brand" is also the placeholder option, so look for the error message.)
    expect(screen.getByText('Select a brand', { selector: '[role=alert]' })).toBeInTheDocument();
    expect(screen.getByText('Select a category', { selector: '[role=alert]' })).toBeInTheDocument();
    expect(screen.getByText('Price is required')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('builds tiers with add / move / remove and sends a normalised payload', async () => {
    const user = userEvent.setup();
    let posted: Call | undefined;
    mockApi(
      ...base,
      route('POST', '/api/admin/products', (call) => {
        posted = call;
        return json({ ...vitaminD, id: 'created' }, 201);
      }),
    );
    const { router } = renderForm('/admin/products/new');

    await user.type(await screen.findByLabelText('Name'), 'Vitamin C');
    await user.selectOptions(screen.getByLabelText('Brand'), MEDICARE);
    await user.selectOptions(screen.getByLabelText('Category'), FIRST_AID);
    await user.type(tier(1).getByLabelText(/Bundle price/), '5.5');
    expect(tier(1).getByText('5.500 KWD for 1 pack')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add tier' }));
    await user.type(tier(2).getByLabelText('Label'), '4 Packs');
    await user.type(tier(2).getByLabelText('Units per bundle'), '4');
    await user.type(tier(2).getByLabelText(/Bundle price/), '19.5');
    expect(tier(2).getByText('4.875 KWD per pack')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add tier' }));
    await user.type(tier(3).getByLabelText('Label'), 'Spare');
    await user.click(screen.getByRole('button', { name: 'Remove tier 3' }));
    await user.click(screen.getByRole('button', { name: 'Move tier 2 up' }));

    await user.click(screen.getByRole('button', { name: 'Create product' }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/admin/products'));

    const body = posted!.body as ProductInput;
    expect(body).toEqual({
      name: 'Vitamin C',
      description: null,
      brandId: MEDICARE,
      categoryId: FIRST_AID,
      images: [],
      tiers: [
        { label: '4 Packs', unitsPerBundle: 4, bundlePrice: '19.500' },
        { label: '1 Pack', unitsPerBundle: 1, bundlePrice: '5.500' },
      ],
    });
  });

  it('flags duplicate units and too many decimals inline', async () => {
    const user = userEvent.setup();
    mockApi(...base);
    renderForm('/admin/products/new');
    await user.type(await screen.findByLabelText('Name'), 'X');
    await user.type(tier(1).getByLabelText(/Bundle price/), '1.2345');
    await user.click(screen.getByRole('button', { name: 'Add tier' }));
    await user.type(tier(2).getByLabelText('Label'), 'Again');
    await user.type(tier(2).getByLabelText('Units per bundle'), '1');
    await user.type(tier(2).getByLabelText(/Bundle price/), '2');
    await user.click(screen.getByRole('button', { name: 'Create product' }));

    expect(
      await tier(1).findByText('Price can have at most 3 decimals (fils)'),
    ).toBeInTheDocument();
    expect(tier(2).getByText('Another tier already has 1 unit(s) per bundle')).toBeInTheDocument();
  });

  it('puts server validation errors on the matching fields', async () => {
    const user = userEvent.setup();
    mockApi(
      ...base,
      route('POST', '/api/admin/products', () =>
        json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Please fix the highlighted fields',
              details: [{ path: 'brandId', message: 'This brand no longer exists' }],
            },
          },
          400,
        ),
      ),
    );
    renderForm('/admin/products/new');
    await user.type(await screen.findByLabelText('Name'), 'X');
    await user.selectOptions(screen.getByLabelText('Brand'), MEDICARE);
    await user.selectOptions(screen.getByLabelText('Category'), FIRST_AID);
    await user.type(tier(1).getByLabelText(/Bundle price/), '1');
    await user.click(screen.getByRole('button', { name: 'Create product' }));
    expect(await screen.findByText('This brand no longer exists')).toBeInTheDocument();
    expect(screen.getByLabelText('Brand')).toHaveAttribute('aria-invalid', 'true');
  });

  it('edits an existing product, keeping tier ids and prices as KWD', async () => {
    const user = userEvent.setup();
    let put: Call | undefined;
    // Real tier ids are UUIDs (the schema checks them).
    const ids = ['1', '4', 'c'].map(
      (d) => `${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`,
    );
    const product = { ...vitaminD, tiers: vitaminD.tiers.map((t, i) => ({ ...t, id: ids[i]! })) };
    mockApi(
      ...base,
      route('GET', `/api/products/${vitaminD.id}`, () => json(product)),
      route('PUT', `/api/admin/products/${vitaminD.id}`, (call) => {
        put = call;
        return json(vitaminD);
      }),
    );
    renderForm(`/admin/products/${vitaminD.id}`);
    expect(await screen.findByLabelText('Name')).toHaveValue(vitaminD.name);
    const price = tier(2).getByLabelText(/Bundle price/);
    expect(price).toHaveValue('19.500');
    await user.clear(price);
    await user.type(price, '18.75');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await vi.waitFor(() => expect(put).toBeDefined());
    const body = put!.body as ProductInput;
    expect(body.tiers.map((t) => [t.id, t.bundlePrice])).toEqual([
      [ids[0], '5.500'],
      [ids[1], '18.750'],
      [ids[2], '55.000'],
    ]);
    expect(body.images).toEqual(['/uploads/seed-vitd3.jpg']);
  });

  it('shows not found for a deleted product', async () => {
    mockApi(...base);
    renderForm('/admin/products/00000000-0000-4000-8000-000000000000');
    expect(await screen.findByText('Product not found')).toBeInTheDocument();
  });
});
