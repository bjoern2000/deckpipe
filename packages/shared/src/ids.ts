import crypto from 'node:crypto';

function randomId(length: number): string {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

export function generateDeckId(): string {
  return `dk_${randomId(8)}`;
}

export function generateImageId(): string {
  return `img_${randomId(8)}`;
}

export function generateSlideId(): string {
  return `sld_${randomId(8)}`;
}

export function generateCommentId(): string {
  return `cmt_${randomId(12)}`;
}

export function generateEditKey(): string {
  return randomId(16);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
