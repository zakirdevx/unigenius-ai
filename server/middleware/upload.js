// File upload handling with multer.
// Files stay in memory (memoryStorage) and are never written to disk.
import path from 'node:path';
import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from '../utils/errors.js';

const ALLOWED = {
  '.pdf': ['application/pdf'],
  '.txt': ['text/plain'],
};

export function isAllowedUpload(filename = '', mimetype = '') {
  const ext = path.extname(filename).toLowerCase();
  const mimes = ALLOWED[ext];
  if (!mimes) return false;
  // Some browsers send an empty or generic type for .txt; the extension check still applies.
  return mimes.includes(mimetype) || mimetype === '' || mimetype === 'application/octet-stream';
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter(req, file, cb) {
    if (isAllowedUpload(file.originalname, file.mimetype)) return cb(null, true);
    cb(new HttpError(400, 'Only .pdf and .txt files are supported.', 'BAD_FILE_TYPE'));
  },
});
