# CLAUDE.md — NCG Pharmacy (standalone version)

Read this file, then `docs/TASKS.md`, and work through the tasks in order, one at a time.

## The assignment

Technical assessment for National Care Group: a medical e-commerce app with
**multi-tier (bundle) pricing**, built from scratch. Required: Home / product listing,
Product details, Cart, Admin (products, brands, categories, pricing tiers) backed by a real
database. Auth, checkout, payment, orders and inventory are **out of scope**.
Brief's tech preference: React + TypeScript + Tailwind CSS, a real backend and a persistent
database (no mock data / localStorage for the catalog), deployed on a live link.

Production target: an existing **Namecheap shared hosting (cPanel)** server, subdomain
`ncg.muhammadessam.me` with **DNS managed in Cloudflare** (record points to the Namecheap server IP), served by ONE
Node.js app (cPanel "Setup Node.js App" / Passenger) that serves both the API (`/api/*`) and the
built React app (same origin, no CORS). Database: the hosting's **MySQL/MariaDB**.

## Stack

- Monorepo with npm workspaces: `client/` and `server/`, shared types in `shared/`.
- client: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui, React Router, TanStack Query,
  react-hook-form + zod, sonner toasts.
- server: Node 20 + Express + TypeScript, **Drizzle ORM + mysql2** (pure JS: no native binaries,
  which matters on shared hosting — do not use Prisma), zod validation, multer for image uploads
  (stored on disk in `server/uploads`, served at `/uploads`).
- Tests: Vitest (+ supertest for the API, React Testing Library where useful).
- Package manager: npm. Must work on Windows (dev) and Linux (cPanel): use `cross-env`, no bash-only scripts.

## Business rules (reviewers test these first)

1. Each pricing tier is an independent bundle: `units_per_bundle` + `bundle_price`.
   `bundle_price` is the **total** for the bundle, never a per-pack price.
2. Number of tiers per product is dynamic; never hardcode a maximum.
3. Cart lines are keyed by **`tierId`**, not productId. Different tiers of the same product are
   separate lines; adding the same tier again increases `bundles`.
4. Line total = `bundle_price × bundles`; internal pack quantity = `units_per_bundle × bundles`.
   Brief's example: 2 × "4 Packs" at 19.500 KWD = 8 packs = **39.000 KWD**.
5. Money: DB column `DECIMAL(10,3)`; the API converts to **integer fils** (1 KWD = 1000 fils) and
   returns `bundlePriceFils`; all math uses integers (`shared/money.ts`: `toFils`, `formatKWD`).
   Display KWD with exactly 3 decimals. No float math, no `toFixed`.
6. Quantities are integers 1–99; invalid input is rejected/clamped and never breaks the UI.
7. Every page has loading, error and empty states; works at 360px, 768px and 1280px.
8. Validate on BOTH sides: zod schemas in `shared/` used by the client forms and the API.

## Conventions

- client: `src/features/{catalog,cart,admin}`, `src/pages`, `src/components/ui`, `src/lib`.
- server: `src/db` (schema, migrations, seed), `src/routes`, `src/services`, `src/middleware`
  (validation, error handler), `src/app.ts` (Express app, exported for tests), `src/index.ts` (listen).
- API errors are JSON `{ error: { code, message, details? } }` with correct HTTP status codes.
- Config only from env vars (`DATABASE_URL`, `PORT`, `NODE_ENV`, `UPLOAD_DIR`); provide `.env.example`.
  Never commit `.env` or credentials.

## Git workflow

- Small, focused commits with clear messages; push after each finished task.
- Before every push: `npm run lint`, `npm test` and `npm run build` pass.
- After each task, stop and give me a short summary + what to check manually.
