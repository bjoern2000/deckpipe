import { z } from 'zod';

// --- Focal point for smart image cropping ---
const FocalPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export type FocalPoint = z.infer<typeof FocalPointSchema>;

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
  image_focus: FocalPointSchema.optional(),
});

const TitleAndBodyContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().min(1),
  body: z.string().min(1),
  image_url: z.string().url().optional(),
  image_focus: FocalPointSchema.optional(),
  table: TableSchema.optional(),
});

const TitleAndBulletsContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().min(1),
  bullets: z.array(z.string()).min(1),
  image_url: z.string().url().optional(),
  image_focus: FocalPointSchema.optional(),
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
  image_focus: FocalPointSchema.optional(),
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
  image_focus: FocalPointSchema.optional(),
});

// --- New layout content schemas ---
const ImageDetailSchema = z.object({
  title: z.string().optional(),
  caption: z.string().optional(),
});

const ImageGalleryContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().optional(),
  caption: z.string().optional(),
  images: z.array(z.string().url()).min(2).max(5),
  image_details: z.array(ImageDetailSchema).optional(),
  image_focuses: z.array(FocalPointSchema).optional(),
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
  image_focus: FocalPointSchema.optional(),
});

const FullImageContentSchema = z.object({
  ...BaseContentFields,
  image_url: z.string().url(),
  image_focus: FocalPointSchema.optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
});

// --- Timeline ---
const TimelineEventSchema = z.object({
  label: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  position: z.number().min(0).max(1).optional(),
});

const TimelineContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().optional(),
  events: z.array(TimelineEventSchema).min(3).max(6),
});

// --- Comparison ---
const ComparisonSideSchema = z.object({
  heading: z.string().min(1),
  bullets: z.array(z.string()).min(1).max(6),
  image_url: z.string().url().optional(),
  image_focus: FocalPointSchema.optional(),
});

const ComparisonContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().optional(),
  left: ComparisonSideSchema,
  right: ComparisonSideSchema,
  verdict: z.string().optional(),
});

// --- Code ---
const CodeContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().optional(),
  code: z.string().min(1),
  language: z.string().optional(),
  caption: z.string().optional(),
});

// --- Callout ---
const CalloutContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().optional(),
  value: z.string().min(1),
  label: z.string().optional(),
  body: z.string().optional(),
});

// --- Icons and Text ---
const IconItemSchema = z.object({
  icon: z.string().min(1),
  heading: z.string().min(1),
  description: z.string().optional(),
});

const IconsAndTextContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().optional(),
  items: z.array(IconItemSchema).min(3).max(6),
});

// --- Team ---
const TeamMemberSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  bio: z.string().optional(),
  image_url: z.string().url().optional(),
  image_focus: FocalPointSchema.optional(),
});

const TeamContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().optional(),
  members: z.array(TeamMemberSchema).min(1).max(6),
});

// --- Embed ---
const EmbedContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().optional(),
  url: z.string().url(),
  caption: z.string().optional(),
  aspect_ratio: z.enum(['16:9', '4:3', '1:1']).optional(),
});

// --- Pros and Cons ---
const ProsAndConsContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().optional(),
  pros_heading: z.string().optional(),
  cons_heading: z.string().optional(),
  pros: z.array(z.string()).min(1).max(8),
  cons: z.array(z.string()).min(1).max(8),
});

// --- Agenda ---
const AgendaItemSchema = z.object({
  topic: z.string().min(1),
  duration: z.string().optional(),
  description: z.string().optional(),
});

const AgendaContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().optional(),
  items: z.array(AgendaItemSchema).min(1).max(10),
});

// --- Closing ---
const ClosingContentSchema = z.object({
  ...BaseContentFields,
  heading: z.string().optional(),
  subheading: z.string().optional(),
  contact_lines: z.array(z.string()).max(5).optional(),
  image_url: z.string().url().optional(),
  image_focus: FocalPointSchema.optional(),
});

// --- SWOT ---
const SwotContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().optional(),
  strengths: z.array(z.string()).min(1).max(5),
  weaknesses: z.array(z.string()).min(1).max(5),
  opportunities: z.array(z.string()).min(1).max(5),
  threats: z.array(z.string()).min(1).max(5),
});

// --- Quadrant ---
const QuadrantItemSchema = z.object({
  label: z.string().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const QuadrantContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().optional(),
  body: z.string().optional(),
  bullets: z.array(z.string()).max(6).optional(),
  x_label: z.string().optional(),
  y_label: z.string().optional(),
  quadrant_labels: z.array(z.string()).length(4).optional(),
  items: z.array(QuadrantItemSchema).min(1).max(12),
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
  z.object({ layout: z.literal('timeline'), content: TimelineContentSchema }),
  z.object({ layout: z.literal('comparison'), content: ComparisonContentSchema }),
  z.object({ layout: z.literal('code'), content: CodeContentSchema }),
  z.object({ layout: z.literal('callout'), content: CalloutContentSchema }),
  z.object({ layout: z.literal('icons_and_text'), content: IconsAndTextContentSchema }),
  z.object({ layout: z.literal('team'), content: TeamContentSchema }),
  z.object({ layout: z.literal('embed'), content: EmbedContentSchema }),
  z.object({ layout: z.literal('pros_and_cons'), content: ProsAndConsContentSchema }),
  z.object({ layout: z.literal('agenda'), content: AgendaContentSchema }),
  z.object({ layout: z.literal('closing'), content: ClosingContentSchema }),
  z.object({ layout: z.literal('swot'), content: SwotContentSchema }),
  z.object({ layout: z.literal('quadrant'), content: QuadrantContentSchema }),
]);
export type Slide = z.infer<typeof SlideSchema>;

export const LayoutNames = [
  'title', 'title_and_body', 'title_and_bullets', 'title_and_table',
  'two_columns', 'section_break', 'image_and_text',
  'image_gallery', 'stats', 'quote', 'full_image',
  'timeline', 'comparison', 'code', 'callout',
  'icons_and_text', 'team', 'embed', 'pros_and_cons',
  'agenda', 'swot', 'quadrant', 'closing',
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
  share_url: z.string(),
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
