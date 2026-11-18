import { createDb, createPool } from '../db/client';
import { runMigrations } from '../db/migrate';
import { assertTestDatabase, dropAllTables, TEST_DATABASE_URL } from './test-db';

/** Rebuild the test database from scratch with the real migrations, once per test run. */
export default async function setup(): Promise<void> {
  if (!TEST_DATABASE_URL) {
    console.warn('[test] TEST_DATABASE_URL not set: database tests will be skipped');
    return;
  }
  assertTestDatabase(TEST_DATABASE_URL);
  // A single connection, so FOREIGN_KEY_CHECKS=0 applies to every DROP.
  const pool = createPool(TEST_DATABASE_URL, { connectionLimit: 1 });
  try {
    await dropAllTables(createDb(pool));
  } finally {
    await pool.end();
  }
  await runMigrations(TEST_DATABASE_URL);
}
