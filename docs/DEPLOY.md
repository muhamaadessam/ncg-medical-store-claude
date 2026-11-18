# Deploying to cPanel (Namecheap) with Cloudflare DNS

Target: **https://ncg.muhammadessam.me**, served by **one Node.js app** (cPanel "Setup Node.js App",
Phusion Passenger) that serves both the API (`/api/*`) and the built React app from the same
origin. Database: the hosting's **MariaDB** (11.4 on this server).

Replace `CPANELUSER` below with the cPanel username (shown in cPanel under _General Information_).

| Item                 | Value                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------- |
| Domain               | `ncg.muhammadessam.me` (document root `/home/CPANELUSER/ncg.muhammadessam.me`)          |
| App root (code)      | `/home/CPANELUSER/ncg-app`                                                              |
| Uploads (persistent) | `/home/CPANELUSER/ncg-data/uploads` (outside the app, so redeploys never delete images) |
| Node.js              | 22.x (any version ≥ 20.19 works)                                                        |
| Startup file         | `server/dist/index.js`                                                                  |

## 0. Build the package (on your computer)

```bash
npm ci
```

```bash
npm run package
```

This runs the full build and creates `package-deploy/` and **`ncg-pharmacy-deploy.zip`**:

```
ncg-pharmacy-deploy.zip
├── package.json            production-only (exact versions), scripts: start, db:migrate, db:seed
├── package-lock.json
├── client/dist/            built React app
├── server/dist/            compiled API (startup file: server/dist/index.js)
├── server/drizzle/         SQL migrations
├── server/seed-images/     demo product images
├── server/node_modules/@ncg/shared/   compiled shared code (NOT the root node_modules)
├── DEPLOY.md
└── .env.example
```

There is deliberately **no `node_modules` in the root**: CloudLinux's Node.js selector manages
that folder itself (as a symlink to the app's virtual environment) and refuses apps that ship one.

## 1. Subdomain and HTTPS (Cloudflare)

Already done for this server; for a new one:

1. **cPanel → Domains → Create a New Domain**: `ncg.muhammadessam.me`, untick _Share document
   root_. The document root only holds Passenger's `.htaccess`; the code lives in the app root.
2. **Cloudflare → DNS**: `A` record `ncg` → the server's shared IP, **Proxied** (orange cloud).
3. **Certificate**: this Namecheap plan has no _Run AutoSSL_ button, so use a **Cloudflare Origin
   Certificate** (Cloudflare → SSL/TLS → Origin Server → Create certificate for
   `ncg.muhammadessam.me`), then install it in **cPanel → SSL/TLS → Manage SSL sites** for the
   subdomain. The record must stay **proxied**: the origin certificate is only trusted by
   Cloudflare.
4. **Cloudflare → Rules → Configuration Rules** for hostname `ncg.muhammadessam.me`: SSL **Full
   (strict)** (never _Flexible_, which causes redirect loops), **Rocket Loader off** (it rewrites
   scripts, which the app's Content-Security-Policy blocks), **Email Obfuscation off**.

## 2. Database

1. **cPanel → MySQL® Databases**:
   - Create database `ncg` → `CPANELUSER_ncg`.
   - Create user `ncgapp` → `CPANELUSER_ncgapp` with a generated password. Letters and digits only
     are easiest; otherwise URL-encode special characters (`@` → `%40`, `:` → `%3A`, `/` → `%2F`,
     `#` → `%23`).
   - _Add User To Database_ with **ALL PRIVILEGES**.
2. Build the connection string:

   ```
   mysql://CPANELUSER_ncgapp:PASSWORD@localhost:3306/CPANELUSER_ncg
   ```

   The first migration switches the database to `utf8mb4` (cPanel databases often default to
   `latin1`), so Arabic text and emoji are stored correctly.

## 3. Create the Node.js app

1. **cPanel → File Manager**: create the folders `ncg-app` and `ncg-data/uploads` in the home
   directory.
2. **cPanel → Setup Node.js App → Create Application**:

   | Field                    | Value                                                    |
   | ------------------------ | -------------------------------------------------------- |
   | Node.js version          | **22.x** (the default 14 is too old: pick it explicitly) |
   | Application mode         | **Production**                                           |
   | Application root         | `ncg-app`                                                |
   | Application URL          | `ncg.muhammadessam.me`                                   |
   | Application startup file | `server/dist/index.js`                                   |

3. **Environment variables** (same page, _Add Variable_):

   | Name           | Value                                                              |
   | -------------- | ------------------------------------------------------------------ |
   | `NODE_ENV`     | `production`                                                       |
   | `DATABASE_URL` | `mysql://CPANELUSER_ncgapp:PASSWORD@localhost:3306/CPANELUSER_ncg` |
   | `UPLOAD_DIR`   | `/home/CPANELUSER/ncg-data/uploads`                                |

   `PORT` is **not** needed: Passenger assigns it and the server listens on `process.env.PORT`.

4. Click **Create**. cPanel writes the Passenger configuration into the domain's `.htaccess`.

## 4. Upload and install

1. **File Manager → `ncg-app` → Upload** `ncg-pharmacy-deploy.zip`, then right-click → **Extract**
   into `/home/CPANELUSER/ncg-app` and delete the zip. (`package.json` must end up directly in
   `ncg-app`, not in a subfolder.)
2. **Setup Node.js App → (edit the app) → Run NPM Install**. This installs the production
   dependencies into the app's virtual environment.
3. Create the tables and the demo data, in either of these ways:
   - **Without a terminal**: on the app page, under _Run JS script_, run **`db:migrate`**, then
     **`db:seed`**.
   - **With the terminal** (cPanel → Terminal, or SSH): copy the _"Enter to the virtual
     environment"_ command shown at the top of the app page, then:

     ```bash
     source /home/CPANELUSER/nodevenv/ncg-app/22/bin/activate && cd /home/CPANELUSER/ncg-app
     ```

     ```bash
     npm run db:migrate
     ```

     ```bash
     npm run db:seed
     ```

   Both commands are safe to run again: migrations only apply what is missing, and the seed skips
   products that already exist.

## 5. Restart and verify

Click **Restart** on the app page, then check:

- [ ] https://ncg.muhammadessam.me/api/health → `{"status":"ok","database":"ok",…}`
- [ ] https://ncg.muhammadessam.me → four products with images; filters work.
- [ ] Product page → "4 Packs" × 2 shows `39.000 KWD`; add to cart; the cart shows it.
- [ ] https://ncg.muhammadessam.me/admin → create a product **with an image upload**; it appears in
      the shop; the file is in `ncg-data/uploads`.
- [ ] **Refresh on deep links** (`/products/<id>`, `/cart`, `/admin/brands`) → the page loads (no
      404).
- [ ] https://ncg.muhammadessam.me/does-not-exist → the app's own "Page not found".

## Updating (redeploy)

1. Locally: `npm run package`.
2. In `ncg-app`, delete the old `client`, `server`, `package.json` and `package-lock.json` (never
   touch `ncg-data`, where the uploads live), upload and extract the new zip.
3. **Run NPM Install** (only needed when dependencies changed, harmless otherwise), run
   **`db:migrate`** (applies new migrations only), then **Restart**.

Cloudflare does not cache the HTML (`index.html` is sent with `Cache-Control: no-cache`) or the
API (`no-store`), and JS/CSS files have content-hashed names, so no cache purge is needed. A tab
left open on the old version shows _"A new version is available"_ with a Reload button.

## Troubleshooting

| Symptom                                                       | Fix                                                                                                                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/health` returns `503` / `"database":"unavailable"`      | Check `DATABASE_URL` (user and database names include the `CPANELUSER_` prefix; URL-encode special characters in the password), that the user has ALL PRIVILEGES, then Restart. |
| "We're sorry, but something went wrong" (Passenger page)      | The app crashed on start: read `ncg-app/stderr.log`. Usually missing dependencies (run NPM Install) or the wrong startup file / Node version.                                   |
| Pages work but images are broken                              | `UPLOAD_DIR` must exist and be writable; run `db:seed` again to copy the demo images there.                                                                                     |
| "Cloudflare 526 Invalid SSL certificate"                      | The origin certificate is missing or expired in cPanel, or SSL mode is Full (strict) without it.                                                                                |
| Redirect loop                                                 | Cloudflare SSL mode is _Flexible_: use Full (strict).                                                                                                                           |
| Changes in `.env` / variables not picked up                   | Variables are read at start: click Restart.                                                                                                                                     |
| `npm run db:migrate` says "command not found" in the terminal | Enter the virtual environment first (the `source …/activate` command from the app page).                                                                                        |
