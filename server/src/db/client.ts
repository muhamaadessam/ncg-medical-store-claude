import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { config } from '../config';
import * as schema from './schema';

export type Database = MySql2Database<typeof schema>;

export function createPool(databaseUrl = config.databaseUrl, options: mysql.PoolOptions = {}) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  }
  return mysql.createPool({
    uri: databaseUrl,
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    // Keep DECIMAL as strings so money never passes through a float (see shared/money.ts).
    decimalNumbers: false,
    connectionLimit: 5, // shared hosting: stay well under the per-user connection cap
    waitForConnections: true,
    enableKeepAlive: true,
    ...options,
  });
}

export function createDb(pool: mysql.Pool): Database {
  return drizzle(pool, { schema, mode: 'default' });
}

let pool: mysql.Pool | undefined;
let db: Database | undefined;

/** Lazily created app-wide connection (so importing the app never needs a DB). */
export function getDb(): Database {
  if (!db) {
    pool = createPool();
    db = createDb(pool);
  }
  return db;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  db = undefined;
}
