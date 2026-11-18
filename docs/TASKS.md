# Tasks — NCG Pharmacy (standalone, from scratch)

One task at a time. After each: lint + test + build, commit, push, stop and report.

---

## Task 1 — Monorepo scaffold

- npm workspaces: `client`, `server`, `shared`. Root scripts: `dev` (client + server together via
  `concurrently`), `build` (shared → client → server), `test`, `lint`, `db:migrate`, `db:seed`.
- client: Vite + React + TS + Tailwind + shadcn/ui; Vite dev proxy `/api` and `/uploads` → server.
- server: Express + TS (compiled with `tsc` to `server/dist`), helmet, compression, JSON body limit,
  `GET /api/health`.
- In production the server serves `client/dist` as static files with an SPA fallback to
  `index.html` for non-`/api` routes.
- `shared/money.ts`: `toFils(kwd: number | string): number` (Math.round, throws on NaN),
  `formatKWD(fils: number): string` (integer only, exactly 3 decimals, e.g. `19.500 KWD`) + tests.
- ESLint + Prettier, `.env.example`, `.gitignore` (node_modules, dist, .env, server/uploads/*).

## Task 2 — Database (Drizzle + MySQL)

Tables (InnoDB, utf8mb4):

- `brands`: id (uuid char(36) PK), name varchar(120) NOT NULL UNIQUE, created_at
- `categories`: same shape
- `products`: id, name NOT NULL, description text, brand_id FK → brands **RESTRICT**,
  category_id FK → categories **RESTRICT**, created_at, updated_at
- `product_images`: id, product_id FK **CASCADE**, url, sort_order
- `pricing_tiers`: id, product_id FK **CASCADE**, label NOT NULL, units_per_bundle INT NOT NULL
  CHECK > 0, bundle_price DECIMAL(10,3) NOT NULL CHECK > 0, sort_order INT,
  UNIQUE(product_id, units_per_bundle)

Generate migrations with drizzle-kit and add a migrate script that runs on the server
(`npm run db:migrate`). Seed script (idempotent):

- Brands: MediCare, PharmaPlus · Categories: Vitamins & Supplements, First Aid
- Product A "Digital Thermometer" (MediCare, First Aid): ONE tier — 1 Pack/1 unit/3.750
- Product B "Sterile Gauze Pads (10 pcs)" (PharmaPlus, First Aid): TWO tiers — 1 Pack/1/1.250, 4 Packs/4/4.500
- Product C "Vitamin D3 1000 IU (60 caps)" (MediCare, Vitamins): THREE tiers — 1 Pack/1/5.500,
  4 Packs/4/19.500, 12 Packs/12/55.000
- Product D "Omega-3 Fish Oil (90 softgels)" (PharmaPlus, Vitamins): 1 Pack/1/6.250, 3 Packs/3/17.000
- Short descriptions; images: copy free images into `server/seed-images` and register them.

## Task 3 — REST API

Public:

- `GET /api/products?brandId=&categoryId=` → products with brand, category, images, tiers
  (ordered by sort_order; prices as `bundlePriceFils` integers)
- `GET /api/products/:id` (404 JSON when missing) · `GET /api/brands` · `GET /api/categories`
  (both with product counts)

Admin (no auth — out of scope; prefix `/api/admin`):

- Brands / categories: POST, PATCH, DELETE. Duplicate name → 409. Delete while in use → 409
  "Cannot delete: N products use this brand. Reassign them first."
- Products: POST (create with tiers), PUT /:id (update product + tiers), DELETE /:id.
  Create/update run in ONE DB transaction: upsert product, then delete removed/changed tiers and
  insert changed/new ones (delete first, so swapping units never violates the UNIQUE key).
- `POST /api/admin/uploads` (multer, images only, ≤ 3 MB, random file names) → `{ url }`.
- zod schemas in `shared/` (≥1 tier; units integer ≥1; price > 0 with ≤ 3 decimals; unique units;
  required names). Central error handler; 400 with field details on validation errors.
- Tests with supertest against a test database (or a transaction-rolled-back connection):
  CRUD, validation errors, RESTRICT delete, tier diff/transaction.

## Task 4 — Home page (`/`)

- Desktop: sidebar filter groups "Brands" and "Categories" (with counts); mobile: horizontally
  scrollable chips. Combine brand AND category, "All" + "Clear filters". Filters in the URL
  (`?brand=&category=`).
- Product card: image, name, brand/category badges, ALL tiers as selectable options (label, units,
  bundle price, per-pack price; "Best value" badge when >1 tier, computed by integer
  cross-multiplication). First tier selected. With one tier, show a plain price.
- "Add to cart" adds 1 bundle of the SELECTED tier + toast. Image/name link to the product page.
- Loading skeletons, error card with Retry, empty state with Clear filters.

## Task 5 — Product details (`/products/:id`)

- Gallery (main + thumbnails, placeholder on error), name, brand/category (links to filtered Home),
  description, back link.
- All tiers as large radio cards (keyboard accessible), bundle stepper (1–99 integers with inline hint).
- Live summary: `2 × 4 Packs` · `Total packs: 8` · `Total: 39.000 KWD`.
- Add to cart with `(tierId, bundles)`. Not-found page, error with retry, skeleton.
- Desktop two columns; mobile stacked with a sticky bottom bar (total + Add to cart).

## Task 6 — Cart (`/cart`)

- `CartLine = { tierId, productId, bundles }` persisted in localStorage (try/catch). Prices are NOT
  stored; join with fresh catalog data. Pure `cartMath.ts` (integer fils): line total, line packs,
  subtotal, total bundles, total packs. One store with add / setBundles / remove / clear and
  validation in one place (1–99).
- Missing tier (deleted in admin) → drop line + toast "An offer in your cart is no longer available".
- Page: image + name, offer label, bundle price, stepper, `2 × 4 Packs = 8 packs`, line total, remove.
  Summary: bundles, packs, subtotal; disabled "Checkout" (tooltip: out of scope). Empty state.
  Header badge = number of lines. Desktop rows, mobile cards.
- Tests: 39.000/8 packs; different tiers → 2 lines; same tier twice → 1 line ×2;
  C 1×1 + 2×4 + 1×12 = 99.500 KWD / 21 packs; invalid quantities rejected; missing tier removed.

## Task 7 — Admin (`/admin`)

Banner "Demo admin, no authentication". Tabs Products | Brands | Categories. Invalidate catalog
queries after every mutation.

- Brands/Categories: table with counts, create/rename dialog, delete with confirm, show API 409 messages.
- Products: table (thumbnail, name, brand, category, tier count, price range, actions), search,
  cards on mobile, delete with confirm.
- Product form (`/admin/products/new`, `/admin/products/:id`): name, description, brand, category,
  images (upload with previews, remove, reorder), tiers with `useFieldArray` (add/remove/move,
  label, units, price in KWD, per-pack hint). Shared zod schema, inline errors, disabled Save while
  saving, toasts.

## Task 8 — Polish

States everywhere, root error boundary + 404, responsive pass (360/768/1280, no horizontal scroll,
tap targets ≥ 40px), every price through `formatKWD`, a11y (alt, labels, radio semantics, focus),
lazy images, page titles.

## Task 9 — CI + README

- `.github/workflows/ci.yml`: Node 20, `npm ci`, lint, test (MySQL service container for API tests),
  build.
- README: live link + admin link, features, stack, AI tools used (Claude Code + Claude; mention the
  separate Lovable version if submitted), pricing & cart logic with the 39.000 KWD example, DB
  schema + mermaid ER diagram, project structure, local setup (Windows + Linux), env vars,
  testing (automated + manual checklist), deployment (cPanel steps), known limitations (no auth,
  cart per browser, out-of-scope features, local disk uploads).

## Task 10 — Deploy to Namecheap cPanel + Cloudflare DNS (`ncg.muhammadessam.me`)

Write `docs/DEPLOY.md` and a `npm run package` script that produces a deployable folder/zip:
`server/dist`, `client/dist`, `shared` build, `package.json` + lockfile, migrations, seed.
Steps to document:

1. Namecheap cPanel → Domains: create subdomain `ncg.muhammadessam.me` (document root outside the app root).
   Cloudflare → DNS: `A` record `ncg` → Namecheap server IP (shown in cPanel "Server Information").
   SSL: issue the cert first with the record **DNS only** (grey cloud) so cPanel AutoSSL validates, or
   install a Cloudflare Origin Certificate in cPanel SSL/TLS; then switch to **Proxied** and set
   Cloudflare SSL/TLS mode to **Full (strict)** (never "Flexible": redirect loops). Disable Rocket Loader
   (conflicts with the CSP); purge Cloudflare cache after each deploy (index.html is `no-cache`).
2. MySQL Databases: create DB + user, grant all; build `DATABASE_URL`.
3. Setup Node.js App: Node 20, app root, URL `ncg.muhammadessam.me`, startup file `server/dist/index.js`,
   env vars (`NODE_ENV=production`, `DATABASE_URL`, `UPLOAD_DIR`).
4. Upload the package (File Manager or Git Version Control), "Run NPM Install" (production deps),
   then run `npm run db:migrate` and `npm run db:seed` from the app's terminal/virtualenv command.
5. Restart the app; verify `/api/health`, storefront, admin, image upload, refresh on deep links.
   Make sure the server listens on `process.env.PORT` (Passenger) and that uploads go to a persistent
   folder outside the build output.
