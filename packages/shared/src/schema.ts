import { z } from 'zod';

// --- Base content fields (shared across all layouts) ---
const BaseContentFields = {
  key_takeaway: z.string().optional(),
};

// --- Table ---
export const TableSchema = z.object({
  headers: z.array(z.string()).min(2).max(6),
  rows: z.array(z.array(z.string())).min(1).max(8),
  highlight_column: z.number().int().min(0).optional(),
}).refine(
  (data) => data.rows.every(row => row.length === data.headers.length),
  { message: 'Each row must have the same number of cells as headers' }
);
export type Table = z.infer<typeof TableSchema>;

// --- Layout content schemas ---
const TitleContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  image_url: z.string().url().optional(),
});

const TitleAndBodyContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().min(1),
  body: z.string().min(1),
  image_url: z.string().url().optional(),
  table: TableSchema.optional(),
});

const TitleAndBulletsContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().min(1),
  bullets: z.array(z.string()).min(1),
  image_url: z.string().url().optional(),
});

const TitleAndTableContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().min(1),
  table: TableSchema,
});

const ColumnSchema = z.object({
  heading: z.string().min(1),
  body: z.string().min(1),
});

const TwoColumnsContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().min(1),
  left: ColumnSchema,
  right: ColumnSchema,
  image_url: z.string().url().optional(),
});

const SectionBreakContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().min(1),
});

const ImageAndTextContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().min(1),
  body: z.string().min(1),
  image_url: z.string().url(),
});

// --- New layout content schemas ---
const ImageGalleryContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().optional(),
  caption: z.string().optional(),
  images: z.array(z.string().url()).min(2).max(5),
});

const MetricSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

const StatsContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().optional(),
  metrics: z.array(MetricSchema).min(2).max(4),
});

const QuoteContentSchema = z.object({
  ...BaseContentFields,
  quote: z.string().min(1),
  attribution: z.string().optional(),
  image_url: z.string().url().optional(),
});

const FullImageContentSchema = z.object({
  ...BaseContentFields,
  image_url: z.string().url(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
});

// --- Slide (discriminated union on layout) ---
export const SlideSchema = z.discriminatedUnion('layout', [
  z.object({ layout: z.literal('title'), content: TitleContentSchema }),
  z.object({ layout: z.literal('title_and_body'), content: TitleAndBodyContentSchema }),
  z.object({ layout: z.literal('title_and_bullets'), content: TitleAndBulletsContentSchema }),
  z.object({ layout: z.literal('title_and_table'), content: TitleAndTableContentSchema }),
  z.object({ layout: z.literal('two_columns'), content: TwoColumnsContentSchema }),
  z.object({ layout: z.literal('section_break'), content: SectionBreakContentSchema }),
  z.object({ layout: z.literal('image_and_text'), content: ImageAndTextContentSchema }),
  z.object({ layout: z.literal('image_gallery'), content: ImageGalleryContentSchema }),
  z.object({ layout: z.literal('stats'), content: StatsContentSchema }),
  z.object({ layout: z.literal('quote'), content: QuoteContentSchema }),
  z.object({ layout: z.literal('full_image'), content: FullImageContentSchema }),
]);
export type Slide = z.infer<typeof SlideSchema>;

export const LayoutNames = [
  'title', 'title_and_body', 'title_and_bullets', 'title_and_table',
  'two_columns', 'section_break', 'image_and_text',
  'image_gallery', 'stats', 'quote', 'full_image',
] as const;
export type Layout = typeof LayoutNames[number];

// --- Deck creation ---
export const CreateDeckSchema = z.object({
  title: z.string().min(1),
  heading_font: z.string().min(1).max(100).optional(),
  body_font: z.string().min(1).max(100).optional(),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  slides: z.array(SlideSchema).min(1).max(50),
});
export type CreateDeckInput = z.infer<typeof CreateDeckSchema>;

// --- Deck update ---
const SlideUpdateSchema = z.object({
  index: z.number().int().min(0),
  content: z.record(z.unknown()),
});

export const UpdateDeckSchema = z.object({
  title: z.string().min(1).optional(),
  heading_font: z.string().min(1).max(100).optional(),
  body_font: z.string().min(1).max(100).optional(),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  slides: z.array(SlideUpdateSchema).optional(),
}).refine(
  (data) => data.title !== undefined || data.heading_font !== undefined || data.body_font !== undefined || data.accent_color !== undefined || data.slides !== undefined,
  { message: 'At least one field must be provided for update' }
);
export type UpdateDeckInput = z.infer<typeof UpdateDeckSchema>;

// --- Deck response ---
export const DeckResponseSchema = z.object({
  deck_id: z.string(),
  title: z.string(),
  heading_font: z.string().nullable().optional(),
  body_font: z.string().nullable().optional(),
  accent_color: z.string().nullable().optional(),
  slides: z.array(SlideSchema),
  created_at: z.string(),
  updated_at: z.string(),
});
export type DeckResponse = z.infer<typeof DeckResponseSchema>;

// --- Create deck response ---
export const CreateDeckResponseSchema = z.object({
  deck_id: z.string(),
  viewer_url: z.string(),
  created_at: z.string(),
  slide_count: z.number(),
});
export type CreateDeckResponse = z.infer<typeof CreateDeckResponseSchema>;

// --- Image ---
export const ImageUploadResponseSchema = z.object({
  image_id: z.string(),
  url: z.string(),
  size_bytes: z.number(),
  content_type: z.string(),
});
export type ImageUploadResponse = z.infer<typeof ImageUploadResponseSchema>;
