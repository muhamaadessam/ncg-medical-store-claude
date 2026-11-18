import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import type { UploadResponse } from '@ncg/shared';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { HttpError } from '../../middleware/errors';
import {
  IMAGE_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  readFileHeader,
  sniffImageType,
  UPLOAD_URL_PREFIX,
} from '../../services/uploads';
import type { ApiDeps } from '../deps';

const unsupportedType = () =>
  new HttpError(415, 'UNSUPPORTED_FILE_TYPE', 'Only JPEG, PNG, WebP or GIF images are allowed.');

export function uploadsAdminRouter({ uploadDir }: ApiDeps) {
  const router = Router();

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        fs.mkdir(uploadDir, { recursive: true }).then(
          () => cb(null, uploadDir),
          (err: Error) => cb(err, uploadDir),
        );
      },
      // Random names: never use the client's file name on disk.
      filename: (_req, file, cb) => cb(null, `${randomUUID()}${IMAGE_EXTENSIONS[file.mimetype]}`),
    }),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0 },
    fileFilter: (_req, file, cb) => {
      if (IMAGE_EXTENSIONS[file.mimetype]) cb(null, true);
      else cb(unsupportedType());
    },
  }).single('image');

  /** Turn multer's errors into our JSON error shape. */
  const handleUpload: RequestHandler = (req, res, next) => {
    upload(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new HttpError(413, 'FILE_TOO_LARGE', 'Image must be 3 MB or smaller.'));
        }
        return next(
          new HttpError(400, 'INVALID_UPLOAD', 'Send exactly one image in the "image" field.'),
        );
      }
      next(err);
    });
  };

  router.post('/', handleUpload, async (req, res) => {
    const file = req.file;
    if (!file) {
      throw new HttpError(400, 'INVALID_UPLOAD', 'Send exactly one image in the "image" field.');
    }
    // The declared MIME type is client-controlled: check the actual bytes too.
    const actualType = sniffImageType(await readFileHeader(file.path));
    if (!actualType || actualType !== file.mimetype) {
      await fs.rm(file.path, { force: true });
      throw unsupportedType();
    }
    const body: UploadResponse = { url: `${UPLOAD_URL_PREFIX}${file.filename}` };
    res.status(201).json(body);
  });

  return router;
}
