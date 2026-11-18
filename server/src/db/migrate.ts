import path from 'node:path';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { config } from '../config';
import { createDb, createPool } from './client';

/** `server/drizzle`, from both `server/src/db` (tsx) and `server/dist/db` (compiled). */
export const MIGRATIONS_DIR = path.resolve(__dirname, '../../drizzle');

export async function runMigrations(databaseUrl = config.databaseUrl): Promise<void> {
  const pool = createPool(databaseUrl, { connectionLimit: 1 });
  try {
    await migrate(createDb(pool), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('[db] migrations applied');
    })
    .catch((err: unknown) => {
      console.error('[db] migration failed:', err);
      process.exitCode = 1;
    });
}
