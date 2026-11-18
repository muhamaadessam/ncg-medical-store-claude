import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { apiNotFoundHandler, errorHandler } from './middleware/errors';
import { healthRouter } from './routes/health';

export interface AppOptions {
  /** Serve the built React app with an SPA fallback. Defaults to production mode. */
  serveClient?: boolean;
  clientDistDir?: string;
}

export function createApp(options: AppOptions = {}) {
  const { serveClient = config.isProduction, clientDistDir = config.clientDistDir } = options;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Passenger / Apache on cPanel

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:', 'blob:'],
          // HTTPS is enforced by the host (AutoSSL); don't break plain-HTTP local runs.
          'upgrade-insecure-requests': null,
        },
      },
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));

  // ---- API ----
  const api = express.Router();
  api.use('/health', healthRouter);
  api.use(apiNotFoundHandler);
  app.use('/api', api);

  // ---- Uploaded images ----
  fs.mkdirSync(config.uploadDir, { recursive: true });
  app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', fallthrough: false }));

  // ---- Built React app (production) ----
  if (serveClient) {
    const indexHtml = path.join(clientDistDir, 'index.html');
    // Hashed assets can be cached forever; index.html must always be revalidated.
    app.use(
      '/assets',
      express.static(path.join(clientDistDir, 'assets'), { immutable: true, maxAge: '1y' }),
    );
    app.use(express.static(clientDistDir, { index: false, maxAge: '1h' }));
    // SPA fallback: every non-API GET/HEAD that accepts HTML gets index.html.
    app.use((req, res, next) => {
      if ((req.method !== 'GET' && req.method !== 'HEAD') || !req.accepts('html')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml, (err) => err && next(err));
    });
  }

  app.use(errorHandler);
  return app;
}
