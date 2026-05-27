import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { ApiError } from '@deckpipe/shared';
import { uploadImageLimiter } from '../middleware/rate-limiter.js';
import { saveUploadedImage, saveImageFromUrl, ALLOWED_TYPES } from '../services/image-service.js';
import { config } from '../config.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError('validation_error', `Unsupported file type '${file.mimetype}'. Must be PNG, JPG, WebP, GIF, or SVG.`, 'file'));
    }
  },
});

export const imagesRouter = Router();

// POST /v1/images — Upload an image (multipart file)
imagesRouter.post('/', uploadImageLimiter, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError('validation_error', 'No file provided', 'file');
    }

    const result = await saveUploadedImage(req.file);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /v1/images/from-url — Re-host an image by URL (server fetches it)
imagesRouter.post('/from-url', uploadImageLimiter, async (req, res, next) => {
  try {
    const { url } = req.body ?? {};
    if (!url || typeof url !== 'string') {
      throw new ApiError('validation_error', 'A "url" string is required', 'url');
    }
    const result = await saveImageFromUrl(url);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /v1/images/:filename — Serve an image
imagesRouter.get('/:filename', (req, res) => {
  const filepath = path.join(config.imageStoragePath, req.params.filename);
  // Stored images may include SVG. Prevent any embedded script from running in
  // our origin on direct navigation, and stop MIME sniffing.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.sendFile(path.resolve(filepath), (err) => {
    if (err) {
      res.status(404).json({
        error: { code: 'not_found', message: `Image '${req.params.filename}' not found` },
      });
    }
  });
});
