import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import smartcrop from 'smartcrop-sharp';
import { generateImageId } from '@deckpipe/shared';
import { config } from '../config.js';
import { query } from '../db/client.js';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function extFromContentType(ct: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  };
  return map[ct] || 'png';
}

export async function saveUploadedImage(file: Express.Multer.File) {
  const imageId = generateImageId();
  const ext = extFromContentType(file.mimetype);
  const filename = `${imageId}.${ext}`;
  const filepath = path.join(config.imageStoragePath, filename);

  fs.writeFileSync(filepath, file.buffer);

  await query(
    'INSERT INTO images (image_id, original_filename, content_type, size_bytes) VALUES ($1, $2, $3, $4)',
    [imageId, file.originalname, file.mimetype, file.size]
  );

  return {
    image_id: imageId,
    url: `${config.apiUrl}/v1/images/${filename}`,
    size_bytes: file.size,
    content_type: file.mimetype,
  };
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

async function fetchWithRetry(url: string, retries = 3): Promise<Response | null> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'deckpipe/1.0 (https://deckpipe.com)' },
    });
    if (response.status === 429) {
      const delay = Math.min(parseInt(response.headers.get('retry-after') || '2', 10), 10) * 1000;
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    if (!response.ok) return null;
    return response;
  }
  return null;
}

export async function rehostExternalImage(imageUrl: string): Promise<{ url: string; focus: { x: number; y: number } } | null> {
  try {
    const response = await fetchWithRetry(imageUrl);
    if (!response) return null;

    const contentType = response.headers.get('content-type')?.split(';')[0] || '';
    if (!ALLOWED_TYPES.includes(contentType)) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_SIZE) return null;

    const imageId = generateImageId();
    const ext = extFromContentType(contentType);
    const filename = `${imageId}.${ext}`;
    const filepath = path.join(config.imageStoragePath, filename);

    fs.writeFileSync(filepath, buffer);

    await query(
      'INSERT INTO images (image_id, original_filename, content_type, size_bytes) VALUES ($1, $2, $3, $4)',
      [imageId, imageUrl, contentType, buffer.length]
    );

    const focus = await detectFocalPoint(buffer);

    return {
      url: `${config.apiUrl}/v1/images/${filename}`,
      focus,
    };
  } catch {
    return null;
  }
}

function isExternalUrl(url: string): boolean {
  return url.startsWith('http') && !url.startsWith(config.apiUrl);
}

export async function rehostImagesInDeck(slides: unknown[]): Promise<unknown[]> {
  const result = JSON.parse(JSON.stringify(slides));
  const cache = new Map<string, { url: string; focus: { x: number; y: number } }>();
  let downloadCount = 0;

  async function rehostWithDelay(imageUrl: string) {
    if (cache.has(imageUrl)) return cache.get(imageUrl)!;
    if (downloadCount > 0) await new Promise(r => setTimeout(r, 1500));
    downloadCount++;
    const rehosted = await rehostExternalImage(imageUrl);
    if (rehosted) cache.set(imageUrl, rehosted);
    return rehosted;
  }

  for (const slide of result) {
    const content = (slide as { content: Record<string, unknown> }).content;

    // Handle single image_url
    if (content.image_url && typeof content.image_url === 'string' && isExternalUrl(content.image_url)) {
      const rehosted = await rehostWithDelay(content.image_url);
      if (rehosted) {
        content.image_url = rehosted.url;
        content.image_focus = rehosted.focus;
      }
    }

    // Handle images array (image_gallery layout)
    if (Array.isArray(content.images)) {
      const focuses: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < content.images.length; i++) {
        const imgUrl = content.images[i];
        if (typeof imgUrl === 'string' && isExternalUrl(imgUrl)) {
          const rehosted = await rehostWithDelay(imgUrl);
          if (rehosted) {
            content.images[i] = rehosted.url;
            focuses.push(rehosted.focus);
          } else {
            focuses.push({ x: 0.5, y: 0.5 });
          }
        } else {
          focuses.push({ x: 0.5, y: 0.5 });
        }
      }
      content.image_focuses = focuses;
    }
  }

  return result;
}
