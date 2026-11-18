import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import type { Database } from './db/client';

/** Minimal DB stubs: these tests don't need MySQL (see routes/*.test.ts for real DB tests). */
const healthyDb = { execute: () => Promise.resolve([]) } as unknown as Database;
const downDb = { execute: () => Promise.reject(new Error('ECONNREFUSED')) } as unknown as Database;

describe('app', () => {
  it('GET /api/health returns ok when the database answers', async () => {
    const res = await request(createApp({ serveClient: false, db: healthyDb })).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('GET /api/health returns 503 when the database is down', async () => {
    const res = await request(createApp({ serveClient: false, db: downDb })).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', database: 'unavailable' });
  });

  it('unknown /api routes return a JSON 404', async () => {
    const res = await request(createApp({ serveClient: false })).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route GET /api/nope not found' },
    });
  });

  it('malformed JSON bodies return a JSON 400', async () => {
    const res = await request(createApp({ serveClient: false, db: healthyDb }))
      .post('/api/admin/brands')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('sets security headers', async () => {
    const res = await request(createApp({ serveClient: false, db: healthyDb })).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  describe('serving the client build', () => {
    let dist: string;
    beforeAll(() => {
      dist = fs.mkdtempSync(path.join(os.tmpdir(), 'ncg-dist-'));
      fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><div id="root"></div>');
      fs.mkdirSync(path.join(dist, 'assets'));
      fs.writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.log(1)');
    });
    afterAll(() => fs.rmSync(dist, { recursive: true, force: true }));

    it.each(['/some/random/page', '/products', '/products/1/extra', '/cartx', '/favicon.ico.bak'])(
      'answers unknown path %s with index.html and HTTP 404 (no soft 404)',
      async (url) => {
        const app = createApp({ serveClient: true, clientDistDir: dist });
        const res = await request(app).get(url).set('Accept', 'text/html');
        expect(res.status).toBe(404);
        expect(res.text).toContain('id="root"'); // the React 404 page still renders
      },
    );

    it.each(['/', '/cart', '/products/abc', '/admin', '/admin/products/new', '/admin/brands'])(
      'answers client route %s with 200',
      async (url) => {
        const app = createApp({ serveClient: true, clientDistDir: dist });
        const res = await request(app).get(url).set('Accept', 'text/html');
        expect(res.status).toBe(200);
      },
    );

    it('falls back to index.html for deep links', async () => {
      const app = createApp({ serveClient: true, clientDistDir: dist });
      const res = await request(app).get('/products/123').set('Accept', 'text/html');
      expect(res.status).toBe(200);
      expect(res.text).toContain('id="root"');
      expect(res.headers['cache-control']).toBe('no-cache');
    });

    it('serves hashed assets with long cache', async () => {
      const app = createApp({ serveClient: true, clientDistDir: dist });
      const res = await request(app).get('/assets/app.js');
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toContain('immutable');
    });

    it('does not fall back for /api routes', async () => {
      const app = createApp({ serveClient: true, clientDistDir: dist });
      const res = await request(app).get('/api/missing').set('Accept', 'text/html');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});

describe('uploads', () => {
  it('missing upload files return a JSON 404', async () => {
    const res = await request(createApp({ serveClient: false })).get('/uploads/does-not-exist.jpg');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
