# NCG Pharmacy

A medical e-commerce demo with **multi-tier (bundle) pricing**, built for the National Care Group
technical assessment: storefront, product details, cart and an admin for products, brands,
categories and pricing tiers, backed by a real MySQL/MariaDB database.

- **Live:** https://ncg.muhammadessam.me
- **Admin:** https://ncg.muhammadessam.me/admin (demo admin, no authentication)
- **Health:** https://ncg.muhammadessam.me/api/health

[![CI](https://github.com/muhamaadessam/ncg-medical-store-claude/actions/workflows/ci.yml/badge.svg)](https://github.com/muhamaadessam/ncg-medical-store-claude/actions/workflows/ci.yml)

| Product details (2 × "4 Packs" = 8 packs = 39.000 KWD) | Cart                                              |
| ------------------------------------------------------ | ------------------------------------------------- |
| ![Product page](docs/screenshots/product.jpg)          | ![Cart](docs/screenshots/cart.jpg)                |
| **Home with filters**                                  | **Admin product form (mobile)**                   |
| ![Home](docs/screenshots/home.jpg)                     | ![Admin form](docs/screenshots/admin-product.jpg) |

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Pricing and cart logic](#pricing-and-cart-logic)
- [Database](#database)
- [API](#api)
- [Project structure](#project-structure)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)
- [AI tools used](#ai-tools-used)

## Features

**Storefront**

- **Home (`/`)**: product grid with brand and category filters (sidebar on desktop, scrollable
  chips on mobile) that combine with AND, live in the URL (`?brand=&category=`) and show product
  counts. Every card lists **all** of the product's tiers as selectable options with bundle
  price, per-pack price, "Best value" and "Save x%" badges; the first tier is preselected and
  "Add to cart" adds one bundle of the **selected** tier.
- **Product details (`/products/:id`)**: image gallery, brand/category links to the filtered
  home, large keyboard-accessible tier cards, a 1–99 bundle stepper and a live summary
  (`2 × 4 Packs · Total packs: 8 · Total: 39.000 KWD`). On mobile a sticky bar keeps the total
  and "Add to cart" in reach.
- **Cart (`/cart`)**: one line per **tier**, quantity stepper, `2 × 4 Packs = 8 packs`, line
  totals, bundles / packs / subtotal summary, remove and clear (with Undo). Prices are always
  re-read from the API; offers deleted in the admin are dropped with a notice. Checkout is shown
  disabled (out of scope).

**Admin (`/admin`)**

- Products: table (cards on mobile) with thumbnail, brand, category, tier count, price range and
  search; create / edit / delete.
- Product form: name, description, brand, category, image upload (previews, remove, reorder) and
  **any number of tiers** (add, remove, reorder, per-pack hint).
- Brands and categories: create, rename, delete. Duplicate names and deleting something still in
  use are refused with a clear message (`Cannot delete: 2 products use this brand. Reassign them
first.`).

**Everywhere**: loading skeletons, error states with Retry, empty states, a 404 page and an error
boundary; works at 360 px, 768 px and 1280 px without horizontal scrolling; tap targets ≥ 40 px;
checked with axe-core (WCAG 2.1 AA) at all three widths.

## Tech stack

| Area       | Choice                                                                                                                           | Why                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Client     | React 18, Vite, TypeScript, Tailwind CSS v4, shadcn/ui-style components, React Router 7, TanStack Query, react-hook-form, sonner | As requested in the brief                                                    |
| Server     | Node 20+, Express 5, TypeScript, helmet, compression, multer                                                                     | One small app that serves the API **and** the built client                   |
| Database   | MySQL / MariaDB with **Drizzle ORM + mysql2**                                                                                    | Pure JavaScript (no native binaries), which matters on cPanel shared hosting |
| Validation | **zod** schemas in `shared/`, used by the client forms **and** the API                                                           | One source of truth for every rule                                           |
| Tests      | Vitest, supertest, React Testing Library                                                                                         | 185 tests, API tests run against a real MariaDB                              |
| Monorepo   | npm workspaces: `client`, `server`, `shared`                                                                                     | Shared types, schemas and money helpers                                      |

## Pricing and cart logic

### Rules

1. A **pricing tier** is an independent bundle: `units_per_bundle` + `bundle_price`.
   `bundle_price` is the **total** price of the bundle, never a per-pack price.
2. A product can have any number of tiers (no hardcoded maximum).
3. Cart lines are keyed by **`tierId`**: different tiers of the same product are separate lines;
   adding the same tier again increases `bundles` on that line.
4. **Line total = `bundle_price × bundles`**, **packs = `units_per_bundle × bundles`**.
5. Quantities are integers from 1 to 99; anything else is rejected or clamped.

### Worked example (from the brief)

Vitamin D3 has three tiers: 1 Pack = 5.500, 4 Packs = 19.500, 12 Packs = 55.000 KWD.

| Cart line        | Line total                  | Packs         |
| ---------------- | --------------------------- | ------------- |
| 2 × "4 Packs"    | 19.500 × 2 = **39.000 KWD** | 4 × 2 = **8** |
| + 1 × "1 Pack"   | 5.500                       | 1             |
| + 1 × "12 Packs" | 55.000                      | 12            |
| **Cart total**   | **99.500 KWD**              | **21 packs**  |

Both rows are automated tests (`client/src/features/cart/cartMath.test.ts`, `CartPage.test.tsx`).

### Money: integer fils, never floats

- The database stores `DECIMAL(10,3)`; mysql2 returns it as an exact string (`"19.500"`).
- The API converts it to **integer fils** (1 KWD = 1000 fils) and returns `bundlePriceFils: 19500`.
- All arithmetic (line totals, subtotals, per-pack prices, "best value", savings) uses integers.
  Per-pack price is integer division rounded half-up for display only; "best value" compares
  tiers by cross-multiplication (`priceA × unitsB < priceB × unitsA`) so rounding never decides
  it.
- Display always goes through `formatKWD(fils)` → `"39.000 KWD"` (exactly 3 decimals). There is
  no `toFixed` and no float math anywhere (`shared/src/money.ts`, `shared/src/pricing.ts`).

### Cart storage and freshness

The cart stores only `{ tierId, productId, bundles }` in `localStorage` (wrapped in try/catch;
corrupt data is sanitised). Prices are never stored: when the cart is shown, each product is
fetched again and the lines are joined with fresh data (`reconcileCart`).

- If a tier was deleted in the admin, or the whole product was deleted (404), the line is
  removed and the shopper sees _"An offer in your cart is no longer available"_.
- A network or server error **never** removes anything; the page shows an error with Retry.
- When an admin changes a tier's label or price but keeps its bundle size, the tier keeps its id,
  so carts keep the line and show the new price. Changing the bundle size (e.g. 4 → 6 packs)
  makes it a new offer with a new id.

## Database

Tables are InnoDB, `utf8mb4` (the first migration converts the database itself, because cPanel
databases often default to `latin1`). Primary keys are UUIDs (`char(36)`).

```mermaid
erDiagram
    brands ||--o{ products : "brand_id (RESTRICT)"
    categories ||--o{ products : "category_id (RESTRICT)"
    products ||--o{ product_images : "product_id (CASCADE)"
    products ||--|{ pricing_tiers : "product_id (CASCADE)"

    brands {
        char(36) id PK
        varchar(120) name UK
        timestamp created_at
    }
    categories {
        char(36) id PK
        varchar(120) name UK
        timestamp created_at
    }
    products {
        char(36) id PK
        varchar(200) name
        text description
        char(36) brand_id FK
        char(36) category_id FK
        timestamp created_at
        timestamp updated_at
    }
    product_images {
        char(36) id PK
        char(36) product_id FK
        varchar(500) url
        int sort_order
    }
    pricing_tiers {
        char(36) id PK
        char(36) product_id FK
        varchar(60) label
        int units_per_bundle "CHECK > 0"
        decimal bundle_price "DECIMAL(10,3), CHECK > 0, total for the bundle"
        int sort_order
    }
```

- `UNIQUE(product_id, units_per_bundle)`: a product cannot have two tiers with the same size.
- Deleting a brand or category that products still use is refused (`RESTRICT`); deleting a
  product removes its tiers and images (`CASCADE`).
- **Saving a product is one transaction**: update the product, replace its images, then diff the
  tiers. Unchanged tiers are left alone; removed and changed tiers are **deleted first**, then
  changed and new tiers are inserted, so even swapping sizes between two tiers never trips the
  unique key. A failure anywhere rolls everything back (covered by a test).
- Queries are portable to **MariaDB** and MySQL 5.7/8: no `LATERAL` joins (Drizzle's relational
  API uses them and MariaDB does not support them), `CURRENT_TIMESTAMP` defaults, and DB errors
  are matched by errno because MariaDB and MySQL use different codes for CHECK failures.

Migrations live in `server/drizzle` (generated with drizzle-kit). The seed (`npm run db:seed`) is
idempotent and creates the brief's data: MediCare and PharmaPlus; Vitamins & Supplements and
First Aid; and four products with 1, 2, 3 and 2 tiers.

## API

All responses are JSON. Errors are `{ "error": { "code", "message", "details?" } }` with proper
status codes (400 with per-field `details` for validation errors, 404, 409, 413, 415).

| Method              | Path                                                     | Notes                                                                                                 |
| ------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| GET                 | `/api/health`                                            | `{ status, database }`, 503 if the database is down                                                   |
| GET                 | `/api/products?brandId=&categoryId=`                     | Products with brand, category, images and tiers (ordered); prices as `bundlePriceFils`                |
| GET                 | `/api/products/:id`                                      | 404 when missing                                                                                      |
| GET                 | `/api/brands`, `/api/categories`                         | With `productCount`                                                                                   |
| POST, PATCH, DELETE | `/api/admin/brands[/:id]`, `/api/admin/categories[/:id]` | 409 on duplicate name or delete in use                                                                |
| POST, PUT, DELETE   | `/api/admin/products[/:id]`                              | Product + tiers in one transaction                                                                    |
| POST                | `/api/admin/uploads`                                     | Multipart `image`; JPEG/PNG/WebP/GIF ≤ 3 MB, real file type checked from its bytes; returns `{ url }` |

## Project structure

```
.
├── client/                 React app (Vite)
│   └── src/
│       ├── components/     layout, shared UI (ui/ = shadcn-style primitives)
│       ├── features/
│       │   ├── catalog/    API hooks, filters, product card, tier picker, gallery
│       │   ├── cart/       cart store, cartMath, reconcile, cart components
│       │   └── admin/      admin API hooks, product form, tiers, images, dialogs
│       ├── pages/          route pages (admin/ is lazy-loaded)
│       ├── lib/            fetch wrapper, helpers
│       └── routes.tsx      routes, error boundary
├── server/                 Express API (compiled to server/dist)
│   ├── drizzle/            SQL migrations
│   ├── seed-images/        original illustrations used by the seed
│   └── src/
│       ├── db/             schema, client, migrate, seed
│       ├── routes/         public catalog + admin routers
│       ├── services/       catalog, products (tier diff), taxonomy, uploads
│       ├── middleware/     error handler, validation
│       ├── app.ts          Express app (exported for tests)
│       └── index.ts        listen (PORT)
├── shared/                 zod schemas, API types, money and pricing helpers
├── docs/                   TASKS.md, DEPLOY.md, screenshots
└── docker-compose.yml      optional local MariaDB 11.4
```

## Local setup

Requirements: **Node.js 20.19+** and **MySQL 8 or MariaDB 10.6+** (production uses MariaDB 11.4).

### 1. Start a database

**Option A: Docker (Windows, macOS, Linux)**

```bash
docker compose up -d
```

This creates `ncg_pharmacy` and `ncg_pharmacy_test` with the user and password from `.env.example`.

**Option B: a local MySQL/MariaDB** (MariaDB installer or XAMPP on Windows;
`sudo apt install mariadb-server` on Debian/Ubuntu). Then, as root:

```sql
CREATE DATABASE ncg_pharmacy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE ncg_pharmacy_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ncg'@'localhost' IDENTIFIED BY 'ncg_password';
GRANT ALL PRIVILEGES ON ncg_pharmacy.* TO 'ncg'@'localhost';
GRANT ALL PRIVILEGES ON ncg_pharmacy_test.* TO 'ncg'@'localhost';
```

### 2. Configure and run

Copy the example environment file (Windows PowerShell: `Copy-Item .env.example .env`;
cmd: `copy .env.example .env`):

```bash
cp .env.example .env
```

Install, create the tables, add the demo data and start everything:

```bash
npm ci
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Open http://localhost:5173 (the Vite dev server proxies `/api` and `/uploads` to the API on
port 3001). To run the production build locally: `npm run build` then `npm start`, and open
http://localhost:3001.

| Script                           | What it does                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                    | API (tsx watch) + client (Vite) + shared (tsc watch) together                                                |
| `npm run build`                  | Builds shared → client → server                                                                              |
| `npm start`                      | Runs the built server, which also serves `client/dist`                                                       |
| `npm test`                       | All tests (shared, client, server)                                                                           |
| `npm run lint`                   | ESLint + Prettier check + TypeScript                                                                         |
| `npm run db:migrate` / `db:seed` | Apply migrations / add demo data (`npm run db:seed -- --reset` wipes the catalog first)                      |
| `npm run package`                | Build + create `package-deploy/` and `ncg-pharmacy-deploy.zip` for cPanel ([docs/DEPLOY.md](docs/DEPLOY.md)) |
| `npm run db:generate`            | Generate a migration after changing `server/src/db/schema.ts`                                                |

Everything works the same on Windows and Linux (no shell-specific scripts; `cross-env` where
needed).

## Environment variables

| Variable            | Example                                                | Purpose                                                                          |
| ------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `DATABASE_URL`      | `mysql://ncg:ncg_password@localhost:3306/ncg_pharmacy` | Main database                                                                    |
| `PORT`              | `3001`                                                 | HTTP port (set automatically by Passenger on cPanel)                             |
| `NODE_ENV`          | `development` / `production`                           | `production` serves the built client and hides error details                     |
| `UPLOAD_DIR`        | `./server/uploads`                                     | Where uploaded images are stored; keep it outside the build output in production |
| `TEST_DATABASE_URL` | `mysql://…/ncg_pharmacy_test`                          | Tests only. **Wiped on every run**; the name must end in `_test`                 |

`.env` is git-ignored; `.env.example` lists everything.

## Testing

### Automated

```bash
npm test
```

| Package  | Tests | What is covered                                                                                                                                                                                                                                                                                       |
| -------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared` | 38    | `toFils` / `formatKWD` (no float errors), per-pack price, best value, savings, all zod rules                                                                                                                                                                                                          |
| `client` | 81    | cart logic and math (39.000 / 8 packs, 99.500 / 21 packs, tier-keyed lines, 1–99 clamping, deleted offers), stepper, product card, home filters, product page, cart page, admin pages and product form (field array, inline and server errors), 404 and error boundary                                |
| `server` | 66    | every endpoint with supertest against **real MariaDB/MySQL**: CRUD, validation (400 + field paths), duplicate names (409), RESTRICT delete (409), CASCADE, tier diff (keep / change / swap units / reorder), transaction rollback, uploads (size, type sniffing, random names, cleanup), SPA fallback |

API tests need `TEST_DATABASE_URL`; without it they are skipped locally, and they are required in
CI. GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci`, lint, tests against a
**MariaDB 11.4** service container (same engine as production) and the build on Node 20.

### Manual checklist

- [ ] Vitamin D3 → choose "4 Packs", bundles 2 → summary shows `2 × 4 Packs`, 8 packs, `39.000 KWD`.
- [ ] Add "4 Packs" twice from the home page → the cart has **one** line with 2 bundles.
- [ ] Add "1 Pack" of the same product → the cart now has **two** lines.
- [ ] Cart with 1×1 + 2×4 + 1×12 of Vitamin D3 → `99.500 KWD`, 21 packs.
- [ ] Type `150`, `0` or `abc` in a stepper → it never breaks; values snap to 1–99 with a hint.
- [ ] Filter by MediCare + First Aid → only the thermometer; reload keeps the filters.
- [ ] Admin: create a product with 3 tiers and an image → it appears in the shop immediately.
- [ ] Admin: tier price `1.2345`, or two tiers with the same units → inline errors, nothing saved.
- [ ] Admin: delete MediCare → "Cannot delete: 2 products use this brand. Reassign them first."
- [ ] Add a tier to the cart, delete that tier in the admin, open the cart → line removed with
      "An offer in your cart is no longer available".
- [ ] 360 px, 768 px and 1280 px: no horizontal scroll; keyboard: Tab / arrow keys reach every
      control; refresh on a deep link (e.g. `/products/<id>`, `/admin/brands`) works.

## Deployment

Production runs on **Namecheap shared hosting (cPanel)** as a single Node.js app
(cPanel "Setup Node.js App" / Passenger) serving both `/api/*` and the built React app on the same
origin (no CORS). DNS for the subdomain is on **Cloudflare** (proxied, SSL "Full (strict)" with a
Cloudflare Origin Certificate installed in cPanel).

In short: create the database and user in cPanel, create the Node.js app (Node 22, startup file
`server/dist/index.js`, `NODE_ENV=production`, `DATABASE_URL`, `UPLOAD_DIR` outside the app's
build output), upload the deployment package, run NPM install, `db:migrate` and `db:seed`, then
restart and check `/api/health`. The step-by-step guide is in [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Known limitations

- **No authentication**: the admin is open to anyone with the link (out of scope; marked with a
  banner). Do not use real data.
- **Cart per browser**: stored in `localStorage`, not shared across devices, no server-side cart.
- **Out of scope**: checkout, payment, orders, inventory/stock, users, discounts beyond tier
  pricing.
- **Uploads on local disk**: images are stored in `UPLOAD_DIR` on the server (fine for a single
  shared-hosting instance; a multi-server setup would need object storage). Unused files are
  deleted when products change.
- Prices are in KWD only; the UI is English only.

## AI tools used

Built with **Claude Code** (Anthropic) as the main development agent: scaffolding, implementation,
tests, debugging in a real browser (Playwright screenshots and axe-core audits at 360/768/1280)
and documentation, working task by task from [`docs/TASKS.md`](docs/TASKS.md) and the project
rules in [`CLAUDE.md`](CLAUDE.md). **Claude** (chat) was used for planning and reviewing.
Every task was reviewed, tested (`npm run lint`, `npm test`, `npm run build`) and committed
separately; the git history shows the progression.

<!-- If the separate Lovable version is submitted, add its link here. -->
