import path from 'node:path';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { config } from '../config';
import { createDb, createPool } from './client';
import { repairSchema } from './repair';

/** `server/drizzle`, from both `server/src/db` (tsx) and `server/dist/db` (compiled). */
export const MIGRATIONS_DIR = path.resolve(__dirname, '../../drizzle');

export async function runMigrations(
  databaseUrl = config.databaseUrl,
  options: { uploadDir?: string; log?: (message: string) => void } = {},
): Promise<void> {
  const pool = createPool(databaseUrl, { connectionLimit: 1 });
  try {
    const db = createDb(pool);
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    // Tables created on a MyISAM-default server lose their foreign keys: put them right.
    await repairSchema(db, options);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations(config.databaseUrl, {
    uploadDir: config.uploadDir,
    log: (message) => console.log(`[db] ${message}`),
  })
    .then(() => {
      console.log('[db] migrations applied');
    })
    .catch((err: unknown) => {
      console.error('[db] migration failed:', err);
      process.exitCode = 1;
    });
}
