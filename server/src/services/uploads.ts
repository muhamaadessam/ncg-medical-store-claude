import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { inArray } from 'drizzle-orm';
import type { Database } from '../db/client';
import { productImages } from '../db/schema';

export const UPLOAD_URL_PREFIX = '/uploads/';
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

/** Allowed image types → file extension. SVG is deliberately excluded (it can carry scripts). */
export const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/** Detect the real image type from the file's first bytes (never trust the client's MIME type). */
export function sniffImageType(header: Buffer): string | undefined {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return 'image/jpeg';
  }
  if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (
    header.subarray(0, 4).toString('ascii') === 'RIFF' &&
    header.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  const gif = header.subarray(0, 6).toString('ascii');
  if (gif === 'GIF87a' || gif === 'GIF89a') return 'image/gif';
  return undefined;
}

export async function readFileHeader(filePath: string, bytes = 16): Promise<Buffer> {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** Absolute path of an `/uploads/<file>` URL inside `uploadDir`, or undefined if it is not one. */
export function uploadPath(uploadDir: string, url: string): string | undefined {
  if (!url.startsWith(UPLOAD_URL_PREFIX)) return undefined;
  const name = url.slice(UPLOAD_URL_PREFIX.length);
  if (!name || name !== path.basename(name)) return undefined;
  return path.join(uploadDir, name);
}

export interface OrphanCleanupResult {
  deleted: string[];
  /** Files that could not be removed (logged once each with the reason). */
  failed: string[];
}

/**
 * Delete upload files that no product references any more. Runs after the DB transaction
 * committed; a failure never fails the request, but it is LOGGED with the absolute path, the error
 * code (EACCES, EPERM, ...) and the upload folder, so a misconfigured UPLOAD_DIR or wrong file
 * permissions show up in the server log (stderr.log on cPanel) instead of passing silently.
 */
export async function removeOrphanUploads(
  db: Database,
  uploadDir: string,
  urls: string[],
): Promise<OrphanCleanupResult> {
  const result: OrphanCleanupResult = { deleted: [], failed: [] };
  const candidates = [...new Set(urls)].filter((url) => uploadPath(uploadDir, url));
  if (candidates.length === 0) return result;
  const stillUsed = await db
    .select({ url: productImages.url })
    .from(productImages)
    .where(inArray(productImages.url, candidates));
  const used = new Set(stillUsed.map((r) => r.url));
  for (const url of used) {
    // Not an error, but say so: this is what silently kept deleted images on disk before.
    console.error(`[uploads] kept ${url}: another product still uses it`);
  }

  for (const url of candidates.filter((u) => !used.has(u))) {
    const file = uploadPath(uploadDir, url)!;
    try {
      await fs.rm(file, { force: true });
      // `force` hides ENOENT: make sure the file is really gone.
      if (await exists(file))
        throw Object.assign(new Error('file still exists after rm'), { code: 'ESTILL' });
      result.deleted.push(url);
    } catch (err) {
      result.failed.push(url);
      const { code, message } = err as NodeJS.ErrnoException;
      console.error(
        `[uploads] could not delete ${file} (${code ?? 'error'}: ${message}); uploadDir=${uploadDir}`,
      );
    }
  }
  return result;
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/** Startup check: the folder exists and the app can create/delete files in it. */
export async function checkUploadDir(uploadDir: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.access(uploadDir, fsConstants.W_OK | fsConstants.X_OK);
    return { ok: true };
  } catch (err) {
    const { code, message } = err as NodeJS.ErrnoException;
    return { ok: false, error: `${code ?? 'error'}: ${message}` };
  }
}
