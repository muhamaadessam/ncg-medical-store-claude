/**
 * Build a self-contained deployment folder + zip for cPanel ("Setup Node.js App" / Passenger).
 *
 *   npm run package   →   package-deploy/  and  ncg-pharmacy-deploy.zip
 *
 * Why not just upload the repo?
 * - CloudLinux's Node.js selector forbids a `node_modules` folder in the app root (it manages its
 *   own, as a symlink) and runs `npm install` itself; workspaces and dev tools are not wanted there.
 * - So the package gets a production-only package.json (exact versions we tested) + lockfile, and
 *   the compiled `@ncg/shared` is placed in `server/node_modules/` where Node resolves it from
 *   `server/dist` without touching the root `node_modules` that cPanel manages.
 *
 * Cross-platform (Windows + Linux): only Node APIs and `archiver`, no shell tools.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'package-deploy');
const ZIP = path.join(ROOT, 'ncg-pharmacy-deploy.zip');
const rel = (...p) => path.join(ROOT, ...p);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function fail(message) {
  console.error(`\n[package] ${message}\n`);
  process.exit(1);
}

// 1. The build must exist (npm run package runs `npm run build` first).
for (const file of ['client/dist/index.html', 'server/dist/index.js', 'shared/dist/index.js']) {
  if (!fs.existsSync(rel(file))) fail(`Missing ${file}. Run "npm run build" first.`);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.rmSync(ZIP, { force: true });
fs.mkdirSync(OUT, { recursive: true });

const copy = (from, to = from, filter = () => true) =>
  fs.cpSync(rel(from), path.join(OUT, to), {
    recursive: true,
    filter: (src) => !src.endsWith('.map') && filter(src),
  });

// 2. Application files.
copy('client/dist');
copy('server/dist', 'server/dist', (src) => !/\.test\.js$/.test(src));
copy('server/drizzle'); // migrations (npm run db:migrate)
copy('server/seed-images'); // demo images (npm run db:seed)
copy('shared/dist', 'server/node_modules/@ncg/shared/dist');

const shared = readJson(rel('shared/package.json'));
fs.writeFileSync(
  path.join(OUT, 'server/node_modules/@ncg/shared/package.json'),
  JSON.stringify(
    {
      name: shared.name,
      version: shared.version,
      private: true,
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
    },
    null,
    2,
  ) + '\n',
);

// 3. Production package.json with the EXACT versions installed (and tested) here.
const server = readJson(rel('server/package.json'));
const requireFromServer = createRequire(rel('server/package.json'));
const runtimeDeps = {
  ...server.dependencies,
  ...shared.dependencies, // zod, used by @ncg/shared at runtime
};
delete runtimeDeps['@ncg/shared']; // shipped in server/node_modules
delete runtimeDeps['cross-env']; // only used by local npm scripts

const dependencies = {};
for (const name of Object.keys(runtimeDeps).sort()) {
  // Some packages do not export ./package.json: find it next to the resolved entry point.
  let dir = path.dirname(requireFromServer.resolve(name));
  while (
    !fs.existsSync(path.join(dir, 'package.json')) ||
    readJson(path.join(dir, 'package.json')).name !== name
  ) {
    const parent = path.dirname(dir);
    if (parent === dir) fail(`Cannot find the installed version of ${name}`);
    dir = parent;
  }
  dependencies[name] = readJson(path.join(dir, 'package.json')).version;
}

const rootPkg = readJson(rel('package.json'));
const prodPkg = {
  name: 'ncg-pharmacy',
  version: rootPkg.version,
  private: true,
  description: 'NCG Pharmacy production bundle (API + built React app)',
  main: 'server/dist/index.js',
  engines: { node: '>=20.19.0' },
  scripts: {
    start: 'node server/dist/index.js',
    'db:migrate': 'node server/dist/db/migrate.js',
    'db:seed': 'node server/dist/db/seed.js',
    'db:seed:reset': 'node server/dist/db/seed.js --reset',
  },
  dependencies,
};
fs.writeFileSync(path.join(OUT, 'package.json'), JSON.stringify(prodPkg, null, 2) + '\n');

// 4. Lockfile for the production dependencies (needs the npm registry, like any install).
try {
  execSync('npm install --package-lock-only --omit=dev --ignore-scripts --no-audit --no-fund', {
    cwd: OUT,
    stdio: 'pipe',
  });
} catch (err) {
  console.warn(
    '[package] Could not generate package-lock.json (offline?). cPanel will create one.',
  );
  console.warn(String(err.stderr || err.message).split('\n')[0]);
}

// 5. Docs and an env template next to the app.
fs.copyFileSync(rel('docs/DEPLOY.md'), path.join(OUT, 'DEPLOY.md'));
fs.writeFileSync(
  path.join(OUT, '.env.example'),
  [
    '# Prefer setting these in cPanel > Setup Node.js App > Environment variables.',
    'NODE_ENV=production',
    'DATABASE_URL=mysql://CPANELUSER_ncgapp:PASSWORD@localhost:3306/CPANELUSER_ncg',
    '# Absolute path OUTSIDE the app folder, so redeploys never delete uploaded images.',
    'UPLOAD_DIR=/home/CPANELUSER/ncg-data/uploads',
    '',
  ].join('\n'),
);

// 6. Zip (contents at the zip root, so it extracts straight into the app folder).
await new Promise((resolve, reject) => {
  const output = fs.createWriteStream(ZIP);
  const archive = archiver('zip', { zlib: { level: 9 } });
  output.on('close', resolve);
  archive.on('error', reject);
  archive.pipe(output);
  archive.directory(OUT, false);
  archive.finalize();
});

const mb = (bytes) => `${Math.round(bytes / 104857.6) / 10} MB`;
console.log(`[package] ${path.relative(ROOT, OUT)}/ ready`);
console.log(`[package] ${path.relative(ROOT, ZIP)} (${mb(fs.statSync(ZIP).size)})`);
console.log(
  '[package] dependencies:',
  Object.entries(dependencies)
    .map(([n, v]) => `${n}@${v}`)
    .join(', '),
);
