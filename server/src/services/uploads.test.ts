import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../db/client';
import { connectTestDb, hasTestDb, truncateCatalog } from '../test/test-db';
import { checkUploadDir, removeOrphanUploads } from './uploads';

describe('checkUploadDir', () => {
  it('creates the folder and reports it writable', async () => {
    const dir = path.join(os.tmpdir(), `ncg-check-${Date.now()}`, 'uploads');
    expect(await checkUploadDir(dir)).toEqual({ ok: true });
    expect(fsSync.existsSync(dir)).toBe(true);
  });

  it('reports a folder it cannot create', async () => {
    const file = path.join(os.tmpdir(), `ncg-file-${Date.now()}`);
    fsSync.writeFileSync(file, 'not a folder');
    const result = await checkUploadDir(path.join(file, 'uploads'));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/^(ENOTDIR|EEXIST)/);
  });
});

describe.skipIf(!hasTestDb)('removeOrphanUploads', () => {
  let db: Database;
  let close: () => Promise<void>;
  let uploadDir: string;

  beforeAll(() => {
    ({ db, close } = connectTestDb());
  });
  afterAll(() => close());
  beforeEach(async () => {
    await truncateCatalog(db);
    uploadDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'ncg-orphans-'));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    fsSync.rmSync(uploadDir, { recursive: true, force: true });
  });

  it('deletes unreferenced files and reports them', async () => {
    fsSync.writeFileSync(path.join(uploadDir, 'a.png'), 'x');
    const result = await removeOrphanUploads(db, uploadDir, ['/uploads/a.png', '/uploads/a.png']);
    expect(result).toEqual({ deleted: ['/uploads/a.png'], failed: [] });
    expect(fsSync.existsSync(path.join(uploadDir, 'a.png'))).toBe(false);
  });

  it('ignores URLs outside the upload folder', async () => {
    const result = await removeOrphanUploads(db, uploadDir, ['/etc/passwd', '/uploads/../x']);
    expect(result).toEqual({ deleted: [], failed: [] });
  });

  it('never fails silently: logs the path, the error code and the upload folder once', async () => {
    const file = path.join(uploadDir, 'locked.png');
    fsSync.writeFileSync(file, 'x');
    const denied = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    vi.spyOn(fs, 'rm').mockRejectedValue(denied);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await removeOrphanUploads(db, uploadDir, ['/uploads/locked.png']);

    expect(result).toEqual({ deleted: [], failed: ['/uploads/locked.png'] });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]![0]).toContain(file);
    expect(log.mock.calls[0]![0]).toContain('EACCES');
    expect(log.mock.calls[0]![0]).toContain(`uploadDir=${uploadDir}`);
  });

  it('reports a file that is still there after rm', async () => {
    fsSync.writeFileSync(path.join(uploadDir, 'stuck.png'), 'x');
    vi.spyOn(fs, 'rm').mockResolvedValue(undefined); // rm "succeeds" but removes nothing
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await removeOrphanUploads(db, uploadDir, ['/uploads/stuck.png']);
    expect(result.failed).toEqual(['/uploads/stuck.png']);
    expect(log.mock.calls[0]![0]).toContain('still exists');
  });
});
