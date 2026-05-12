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

export function generateUnsplashImageId(): string {
  return `uimg_${randomId(8)}`;
}

export function generateCommentId(): string {
  return `cmt_${randomId(12)}`;
}

export function generateEditKey(): string {
  return randomId(16);
}

export function slugify(text: string): string {
  return text
    // German conventions first — umlauts and eszett expand to digraphs,
    // not just stripped (so "Südtirol" becomes "suedtirol", not "sdtirol").
    .replace(/ä/g, 'ae').replace(/Ä/g, 'Ae')
    .replace(/ö/g, 'oe').replace(/Ö/g, 'Oe')
    .replace(/ü/g, 'ue').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    // Decompose remaining accented Latin chars (é→e, ñ→n, ô→o, etc.) by
    // splitting them into base char + combining mark, then dropping the marks.
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
