import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { HomePage } from '@/pages/HomePage';
import { AdminLayout } from '@/pages/admin/AdminLayout';
import { AdminProductFormPage } from '@/pages/admin/AdminProductFormPage';
import { AdminProductsPage } from '@/pages/admin/AdminProductsPage';
import { AdminTaxonomyPage } from '@/pages/admin/AdminTaxonomyPage';
import { CartPage } from '@/pages/CartPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProductPage } from '@/pages/ProductPage';

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/products/:id', element: <ProductPage /> },
      { path: '/cart', element: <CartPage /> },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/admin/products" replace /> },
          { path: 'products', element: <AdminProductsPage /> },
          { path: 'products/new', element: <AdminProductFormPage /> },
          { path: 'products/:id', element: <AdminProductFormPage /> },
          { path: 'brands', element: <AdminTaxonomyPage key="brands" kind="brands" /> },
          { path: 'categories', element: <AdminTaxonomyPage key="categories" kind="categories" /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
