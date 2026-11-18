import path from 'node:path';
import dotenv from 'dotenv';

/** Repository root: two levels up from both `server/src` (tsx) and `server/dist` (compiled). */
export const ROOT_DIR = path.resolve(__dirname, '../..');

// Local convenience only: real environments (cPanel, CI) set variables directly.
dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isTest = nodeEnv === 'test';

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest,
  port: Number(process.env.PORT) || 3001,
  // Tests never touch the dev/prod database, even by accident.
  databaseUrl: (isTest ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL) ?? '',
  uploadDir: path.resolve(ROOT_DIR, process.env.UPLOAD_DIR || 'server/uploads'),
  clientDistDir: path.join(ROOT_DIR, 'client', 'dist'),
} as const;
