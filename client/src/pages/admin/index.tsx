/** Entry point of the lazily loaded admin chunk. */
import { AdminTaxonomyPage } from './AdminTaxonomyPage';

export { AdminLayout } from './AdminLayout';
export { AdminProductFormPage } from './AdminProductFormPage';
export { AdminProductsPage } from './AdminProductsPage';

export function AdminBrandsPage() {
  return <AdminTaxonomyPage key="brands" kind="brands" />;
}

export function AdminCategoriesPage() {
  return <AdminTaxonomyPage key="categories" kind="categories" />;
}
