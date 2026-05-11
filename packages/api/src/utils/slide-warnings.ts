// Known content fields per layout, derived from packages/shared/src/schema.ts
// BaseContentFields (key_takeaway, image_prompt) are included in every layout.

const BASE_FIELDS = ['key_takeaway', 'image_prompt', 'image_attribution', 'image_ref'];

const LAYOUT_FIELDS: Record<string, string[]> = {
  title:             ['title', 'subtitle', 'image_url', 'image_focus'],
  title_and_body:    ['title', 'body', 'image_url', 'image_focus', 'table'],
  title_and_bullets:  ['title', 'bullets', 'image_url', 'image_focus'],
  title_and_table:   ['title', 'table'],
  two_columns:       ['title', 'left', 'right', 'image_url', 'image_focus'],
  section_break:     ['title'],
  image_and_text:    ['title', 'body', 'image_url', 'image_focus'],
  image_gallery:     ['title', 'caption', 'images', 'image_refs', 'image_details', 'image_focuses'],
  stats:             ['title', 'metrics'],
  quote:             ['quote', 'attribution', 'image_url', 'image_focus'],
  full_image:        ['image_url', 'image_focus', 'title', 'subtitle'],
  timeline:          ['title', 'events'],
  comparison:        ['title', 'left', 'right', 'verdict'],
  code:              ['title', 'code', 'language', 'caption'],
  callout:           ['title', 'value', 'label', 'body'],
  icons_and_text:    ['title', 'items'],
  team:              ['title', 'members'],
  embed:             ['title', 'url', 'caption', 'aspect_ratio'],
  pros_and_cons:     ['title', 'pros_heading', 'cons_heading', 'pros', 'cons'],
  agenda:            ['title', 'items'],
  closing:           ['heading', 'subheading', 'contact_lines', 'image_url', 'image_focus'],
  swot:              ['title', 'strengths', 'weaknesses', 'opportunities', 'threats'],
  quadrant:          ['title', 'body', 'bullets', 'x_label', 'y_label', 'quadrant_labels', 'items'],
  venn_diagram:      ['title', 'body', 'circles', 'overlaps'],
  chart:             ['title', 'chart_type', 'data'],
  canvas:            ['html', 'css', 'js', 'static_render_only'],
};

// Pre-compute sets for fast lookup
const LAYOUT_FIELD_SETS: Record<string, Set<string>> = {};
for (const [layout, fields] of Object.entries(LAYOUT_FIELDS)) {
  LAYOUT_FIELD_SETS[layout] = new Set([...fields, ...BASE_FIELDS]);
}

/**
 * Detect content fields that are not recognized for a given layout.
 * Returns human-readable warning strings.
 */
export function detectUnknownFields(
  layout: string,
  contentKeys: string[],
  slideIndex: number,
): string[] {
  const known = LAYOUT_FIELD_SETS[layout];
  if (!known) return [];
  const warnings: string[] = [];
  for (const key of contentKeys) {
    if (!known.has(key)) {
      warnings.push(
        `Slide ${slideIndex} (${layout}): unrecognized content field "${key}" — this field was ignored. Valid fields: ${[...known].sort().join(', ')}`,
      );
    }
  }
  return warnings;
}

/**
 * Extract all image URLs from slides for validation.
 */
export function extractImageUrls(
  slides: Array<{ content?: Record<string, unknown>; layout?: string }>,
): Array<{ url: string; slideIndex: number; field: string }> {
  const urls: Array<{ url: string; slideIndex: number; field: string }> = [];

  slides.forEach((slide, i) => {
    const c = slide.content;
    if (!c) return;

    // Direct image_url
    if (typeof c.image_url === 'string') {
      urls.push({ url: c.image_url, slideIndex: i, field: 'image_url' });
    }

    // image_gallery images[]
    if (Array.isArray(c.images)) {
      c.images.forEach((url: unknown, j: number) => {
        if (typeof url === 'string') {
          urls.push({ url, slideIndex: i, field: `images[${j}]` });
        }
      });
    }

    // team members[].image_url
    if (Array.isArray(c.members)) {
      c.members.forEach((m: unknown, j: number) => {
        if (m && typeof m === 'object' && 'image_url' in m && typeof (m as Record<string, unknown>).image_url === 'string') {
          urls.push({ url: (m as Record<string, string>).image_url, slideIndex: i, field: `members[${j}].image_url` });
        }
      });
    }

    // comparison / two_columns sides
    for (const side of ['left', 'right'] as const) {
      const s = c[side];
      if (s && typeof s === 'object' && 'image_url' in s && typeof (s as Record<string, unknown>).image_url === 'string') {
        urls.push({ url: (s as Record<string, string>).image_url, slideIndex: i, field: `${side}.image_url` });
      }
    }
  });

  return urls;
}

/**
 * Validate image URLs by sending HEAD requests with a short timeout.
 * Returns warning strings for unreachable or erroring URLs.
 */
export async function validateImageUrls(
  imageRefs: Array<{ url: string; slideIndex: number; field: string }>,
): Promise<string[]> {
  if (imageRefs.length === 0) return [];

  const results = await Promise.allSettled(
    imageRefs.map(async ({ url, slideIndex, field }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          redirect: 'follow',
        });
        if (!res.ok) {
          // Some servers reject HEAD — retry with GET
          if (res.status === 405 || res.status === 403) {
            const res2 = await fetch(url, {
              method: 'GET',
              signal: controller.signal,
              redirect: 'follow',
            });
            if (!res2.ok) {
              return `Slide ${slideIndex}: ${field} returned HTTP ${res2.status} — image may not render (${url})`;
            }
            return null;
          }
          return `Slide ${slideIndex}: ${field} returned HTTP ${res.status} — image may not render (${url})`;
        }
        return null;
      } catch {
        return `Slide ${slideIndex}: ${field} is unreachable — image will not render (${url})`;
      } finally {
        clearTimeout(timeout);
      }
    }),
  );

  return results
    .map(r => (r.status === 'fulfilled' ? r.value : null))
    .filter((w): w is string => w !== null);
}
