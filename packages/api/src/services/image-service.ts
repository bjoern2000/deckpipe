import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import smartcrop from 'smartcrop-sharp';
import { generateImageId, ApiError } from '@deckpipe/shared';
import { config } from '../config.js';
import { query } from '../db/client.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

export const ALLOWED_TYPES = Object.keys(EXT_BY_MIME);

function extFromContentType(ct: string): string {
  return EXT_BY_MIME[ct] || 'png';
}

/** Map a sharp-detected format to its MIME type (for URL ingest, where we don't trust the response header). */
function mimeFromSharpFormat(format: string | undefined): string | null {
  switch (format) {
    case 'png': return 'image/png';
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    default: return null;
  }
}

async function detectFocalPoint(buffer: Buffer): Promise<{ x: number; y: number }> {
  try {
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 1;
    const height = metadata.height || 1;
    const result = await smartcrop.crop(buffer, { width: 100, height: 100 });
    const crop = result.topCrop;
    const x = Math.min(1, Math.max(0, (crop.x + crop.width / 2) / width));
    const y = Math.min(1, Math.max(0, (crop.y + crop.height / 2) / height));
    return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
  } catch {
    return { x: 0.5, y: 0.5 };
  }
}

/** Write bytes to disk, record the row, detect focal point, and return the upload response. */
async function persistImage(buffer: Buffer, mime: string, originalName: string) {
  const imageId = generateImageId();
  const ext = extFromContentType(mime);
  const filename = `${imageId}.${ext}`;
  const filepath = path.join(config.imageStoragePath, filename);

  fs.writeFileSync(filepath, buffer);

  await query(
    'INSERT INTO images (image_id, original_filename, content_type, size_bytes) VALUES ($1, $2, $3, $4)',
    [imageId, originalName, mime, buffer.length]
  );

  const focus = await detectFocalPoint(buffer);

  return {
    image_id: imageId,
    url: `${config.apiUrl}/v1/images/${filename}`,
    size_bytes: buffer.length,
    content_type: mime,
    focus,
  };
}

export async function saveUploadedImage(file: Express.Multer.File) {
  return persistImage(file.buffer, file.mimetype, file.originalname);
}

/**
 * Fetch a remote image URL and re-host it. The declared Content-Type isn't
 * trusted — the real format is sniffed from the bytes via sharp, so a
 * mislabeled or extensionless URL still lands in the right place (or is
 * rejected if it isn't actually one of our supported image types).
 */
export async function saveImageFromUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ApiError('validation_error', `Invalid image URL: '${url}'`, 'url');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ApiError('validation_error', 'Image URL must be http(s)', 'url');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let buffer: Buffer;
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) {
      throw new ApiError('validation_error', `Could not fetch image URL (HTTP ${res.status})`, 'url');
    }
    const declaredLength = Number(res.headers.get('content-length'));
    if (declaredLength && declaredLength > MAX_IMAGE_BYTES) {
      throw new ApiError('validation_error', 'Image exceeds 10MB limit', 'url');
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new ApiError('validation_error', 'Image exceeds 10MB limit', 'url');
    }
    buffer = Buffer.from(bytes);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('validation_error', 'Timed out fetching image URL', 'url');
    }
    throw new ApiError('validation_error', `Could not fetch image URL: ${err}`, 'url');
  } finally {
    clearTimeout(timeout);
  }

  let mime: string | null;
  try {
    mime = mimeFromSharpFormat((await sharp(buffer).metadata()).format);
  } catch {
    mime = null;
  }
  // sharp's SVG support depends on librsvg; fall back to a cheap text sniff.
  if (!mime && /<svg[\s>]/i.test(buffer.subarray(0, 1024).toString('utf8'))) {
    mime = 'image/svg+xml';
  }
  if (!mime) {
    throw new ApiError('validation_error', 'URL is not a supported image (PNG, JPG, WebP, GIF, or SVG)', 'url');
  }

  const originalName = parsed.pathname.split('/').pop() || `image.${extFromContentType(mime)}`;
  return persistImage(buffer, mime, originalName);
}
