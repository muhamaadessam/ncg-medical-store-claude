import { sql } from 'drizzle-orm';
import { Router } from 'express';
import type { ApiDeps } from './deps';

/** Liveness + database check; 503 when the database is unreachable. */
export function healthRouter({ db }: Pick<ApiDeps, 'db'>) {
  const router = Router();
  router.get('/', async (_req, res) => {
    let database: 'ok' | 'unavailable' = 'ok';
    try {
      await db().execute(sql`SELECT 1`);
    } catch {
      database = 'unavailable';
    }
    res.status(database === 'ok' ? 200 : 503).json({
      status: database === 'ok' ? 'ok' : 'degraded',
      database,
      uptime: Math.round(process.uptime()),
      time: new Date().toISOString(),
    });
  });
  return router;
}
