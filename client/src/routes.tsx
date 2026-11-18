import { Navigate, type RouteObject } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { PageLoading } from '@/components/PageLoading';
import { CartPage } from '@/pages/CartPage';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProductPage } from '@/pages/ProductPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';

/** The admin is code-split: shoppers never download the forms and admin tables. */
const admin = () => import('@/pages/admin');

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    // Errors in the layout itself (rare) replace the whole page...
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <PageLoading />,
    children: [
      {
        // ...errors in a page keep the header and footer.
        errorElement: <RouteErrorPage />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/products/:id', element: <ProductPage /> },
          { path: '/cart', element: <CartPage /> },
          {
            path: '/admin',
            lazy: () => admin().then((m) => ({ Component: m.AdminLayout })),
            children: [
              { index: true, element: <Navigate to="/admin/products" replace /> },
              {
                path: 'products',
                lazy: () => admin().then((m) => ({ Component: m.AdminProductsPage })),
              },
              {
                path: 'products/new',
                lazy: () => admin().then((m) => ({ Component: m.AdminProductFormPage })),
              },
              {
                path: 'products/:id',
                lazy: () => admin().then((m) => ({ Component: m.AdminProductFormPage })),
              },
              {
                path: 'brands',
                lazy: () => admin().then((m) => ({ Component: m.AdminBrandsPage })),
              },
              {
                path: 'categories',
                lazy: () => admin().then((m) => ({ Component: m.AdminCategoriesPage })),
              },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
