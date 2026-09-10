import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../errors/app-error.js';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(
        new AppError(400, 'VALIDATION_ERROR', 'Invalid file type', [
          { path: 'image', message: 'File type must be jpeg, png or webp' },
        ]),
      );
      return;
    }

    cb(null, true);
  },
});

export function uploadImage(req: Request, res: Response, next: NextFunction): void {
  multerUpload.single('image')(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof AppError) {
      next(err);
      return;
    }

    next(
      new AppError(400, 'VALIDATION_ERROR', 'Invalid file', [
        { path: 'image', message: err instanceof Error ? err.message : 'Invalid file' },
      ]),
    );
  });
}
