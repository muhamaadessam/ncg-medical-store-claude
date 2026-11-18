// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/routes';
import { RootLayout } from '@/components/layout/RootLayout';
import { RouteErrorPage } from './RouteErrorPage';

function Boom({ message }: { message: string }): never {
  throw new Error(message);
}

/** jsdom reports errors React already caught; mark them handled. */
const swallow = (event: ErrorEvent) => event.preventDefault();

function renderApp(path: string, routeList: RouteObject[] = routes) {
  const router = createMemoryRouter(routeList, { initialEntries: [path] });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

/** Same nesting as App: the page-level boundary keeps the header. */
const crashing = (message: string): RouteObject[] => [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        errorElement: <RouteErrorPage />,
        children: [{ path: '/', element: <Boom message={message} /> }],
      },
    ],
  },
];

describe('app shell', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]', { status: 200 })),
    );
    // React logs caught render errors; keep test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.addEventListener('error', swallow);
  });
  afterEach(() => {
    window.removeEventListener('error', swallow);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders a 404 page with a title for unknown routes', async () => {
    renderApp('/definitely/not/here');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(document.title).toBe('Page not found · NCG Pharmacy');
    expect(screen.getByRole('link', { name: 'Back to shop' })).toHaveAttribute('href', '/');
  });

  it('catches render errors and keeps the header', async () => {
    renderApp('/', crashing('kaboom'));
    expect(
      await screen.findByRole('heading', { name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'NCG Pharmacy' })).toBeInTheDocument();
    expect(screen.queryByText('kaboom')).not.toBeInTheDocument(); // no internals shown to users
  });

  it('explains a stale code chunk after a deploy', async () => {
    renderApp('/', crashing('Failed to fetch dynamically imported module: /assets/admin-abc.js'));
    expect(
      await screen.findByRole('heading', { name: 'A new version is available' }),
    ).toBeInTheDocument();
  });

  it('offers a skip link to the main content', async () => {
    const user = userEvent.setup();
    renderApp('/cart');
    await screen.findByRole('heading', { name: 'Your cart is empty' });
    await user.tab();
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute('href', '#main');
    expect(document.getElementById('main')).toBeInTheDocument();
  });
});
