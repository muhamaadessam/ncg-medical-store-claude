import type { Database } from '../db/client';

/** What route handlers need; injected so tests can use a test DB and a temp upload folder. */
export interface ApiDeps {
  db: () => Database;
  uploadDir: string;
}
