import { z } from 'zod';

// --- Focal point for smart image cropping ---
const FocalPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export type FocalPoint = z.infer<typeof FocalPointSchema>;

// --- Image attribution (for Unsplash and other sources) ---
export const ImageAttributionSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  source: z.string(),
  source_url: z.string().url(),
  download_location: z.string().url().optional(),
});
export type ImageAttribution = z.infer<typeof ImageAttributionSchema>;

// --- Base content fields (shared across all layouts) ---
const BaseContentFields = {
  key_takeaway: z.string().optional(),
  image_prompt: z.string().optional(),
  image_attribution: ImageAttributionSchema.optional(),
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

// --- Rich bullet items (backward-compatible: string | object) ---
const BulletSourceSchema = z.object({
  label: z.string().min(1),
  url: z.string().url().optional(),
});

const RichBulletSchema = z.object({
  text: z.string().min(1),
  detail: z.string().optional(),
  sources: z.array(BulletSourceSchema).max(3).optional(),
});

export const BulletItemSchema = z.union([z.string(), RichBulletSchema]);
export type BulletItem = z.infer<typeof BulletItemSchema>;

export function normalizeBullet(b: BulletItem): { text: string; detail?: string; sources?: Array<{ label: string; url?: string }> } {
  if (typeof b === 'string') return { text: b };
  return b;
}

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
  bullets: z.array(BulletItemSchema).min(1),
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
  image_url: z.string().url().optional(),
  image_focus: FocalPointSchema.optional(),
}).refine(d => d.image_url || d.image_prompt, { message: 'image_url or image_prompt is required', path: ['image_url'] });

// --- New layout content schemas ---
const ImageDetailSchema = z.object({
  title: z.string().optional(),
  caption: z.string().optional(),
  attribution: ImageAttributionSchema.optional(),
});

const ImageGalleryContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().optional(),
  caption: z.string().optional(),
  images: z.array(z.string().url()).min(2).max(5).optional(),
  image_details: z.array(ImageDetailSchema).optional(),
  image_focuses: z.array(FocalPointSchema).optional(),
}).refine(d => (d.images && d.images.length > 0) || d.image_prompt, { message: 'images or image_prompt is required', path: ['images'] });

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
  image_url: z.string().url().optional(),
  image_focus: FocalPointSchema.optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
}).refine(d => d.image_url || d.image_prompt, { message: 'image_url or image_prompt is required', path: ['image_url'] });

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
  bullets: z.array(BulletItemSchema).min(1).max(6),
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
  pros: z.array(BulletItemSchema).min(1).max(8),
  cons: z.array(BulletItemSchema).min(1).max(8),
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
  strengths: z.array(BulletItemSchema).min(1).max(5),
  weaknesses: z.array(BulletItemSchema).min(1).max(5),
  opportunities: z.array(BulletItemSchema).min(1).max(5),
  threats: z.array(BulletItemSchema).min(1).max(5),
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
  bullets: z.array(BulletItemSchema).max(6).optional(),
  x_label: z.string().optional(),
  y_label: z.string().optional(),
  quadrant_labels: z.array(z.string()).length(4).optional(),
  items: z.array(QuadrantItemSchema).min(1).max(12),
});

// --- Venn Diagram ---
const VennCircleSchema = z.object({
  label: z.string().min(1),
  items: z.array(z.string()).max(5).optional(),
});

const VennOverlapSchema = z.object({
  sets: z.array(z.number().int().min(0).max(2)).min(2).max(3),
  label: z.string().min(1),
});

const VennDiagramContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().optional(),
  body: z.string().optional(),
  circles: z.array(VennCircleSchema).min(2).max(3),
  overlaps: z.array(VennOverlapSchema).max(4).optional(),
});

// --- Chart ---
const ChartDatasetSchema = z.object({
  label: z.string().optional(),
  values: z.array(z.number()),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const ChartContentSchema = z.object({
  ...BaseContentFields,
  title: z.string().optional(),
  chart_type: z.enum(['bar', 'line', 'pie', 'donut']),
  data: z.object({
    labels: z.array(z.string()).min(2).max(12),
    datasets: z.array(ChartDatasetSchema).min(1).max(5),
  }),
}).refine(
  (d) => d.data.datasets.every(ds => ds.values.length === d.data.labels.length),
  { message: 'Each dataset must have the same number of values as labels', path: ['data'] }
);

// --- Slide (discriminated union on layout) ---
// slide_id is optional on input (auto-generated by API if missing), always present in responses.
const SlideIdField = { slide_id: z.string().optional() };

export const SlideSchema = z.discriminatedUnion('layout', [
  z.object({ layout: z.literal('title'), ...SlideIdField, content: TitleContentSchema }),
  z.object({ layout: z.literal('title_and_body'), ...SlideIdField, content: TitleAndBodyContentSchema }),
  z.object({ layout: z.literal('title_and_bullets'), ...SlideIdField, content: TitleAndBulletsContentSchema }),
  z.object({ layout: z.literal('title_and_table'), ...SlideIdField, content: TitleAndTableContentSchema }),
  z.object({ layout: z.literal('two_columns'), ...SlideIdField, content: TwoColumnsContentSchema }),
  z.object({ layout: z.literal('section_break'), ...SlideIdField, content: SectionBreakContentSchema }),
  z.object({ layout: z.literal('image_and_text'), ...SlideIdField, content: ImageAndTextContentSchema }),
  z.object({ layout: z.literal('image_gallery'), ...SlideIdField, content: ImageGalleryContentSchema }),
  z.object({ layout: z.literal('stats'), ...SlideIdField, content: StatsContentSchema }),
  z.object({ layout: z.literal('quote'), ...SlideIdField, content: QuoteContentSchema }),
  z.object({ layout: z.literal('full_image'), ...SlideIdField, content: FullImageContentSchema }),
  z.object({ layout: z.literal('timeline'), ...SlideIdField, content: TimelineContentSchema }),
  z.object({ layout: z.literal('comparison'), ...SlideIdField, content: ComparisonContentSchema }),
  z.object({ layout: z.literal('code'), ...SlideIdField, content: CodeContentSchema }),
  z.object({ layout: z.literal('callout'), ...SlideIdField, content: CalloutContentSchema }),
  z.object({ layout: z.literal('icons_and_text'), ...SlideIdField, content: IconsAndTextContentSchema }),
  z.object({ layout: z.literal('team'), ...SlideIdField, content: TeamContentSchema }),
  z.object({ layout: z.literal('embed'), ...SlideIdField, content: EmbedContentSchema }),
  z.object({ layout: z.literal('pros_and_cons'), ...SlideIdField, content: ProsAndConsContentSchema }),
  z.object({ layout: z.literal('agenda'), ...SlideIdField, content: AgendaContentSchema }),
  z.object({ layout: z.literal('closing'), ...SlideIdField, content: ClosingContentSchema }),
  z.object({ layout: z.literal('swot'), ...SlideIdField, content: SwotContentSchema }),
  z.object({ layout: z.literal('quadrant'), ...SlideIdField, content: QuadrantContentSchema }),
  z.object({ layout: z.literal('venn_diagram'), ...SlideIdField, content: VennDiagramContentSchema }),
  z.object({ layout: z.literal('chart'), ...SlideIdField, content: ChartContentSchema }),
]);
export type Slide = z.infer<typeof SlideSchema>;

export const LayoutNames = [
  'title', 'title_and_body', 'title_and_bullets', 'title_and_table',
  'two_columns', 'section_break', 'image_and_text',
  'image_gallery', 'stats', 'quote', 'full_image',
  'timeline', 'comparison', 'code', 'callout',
  'icons_and_text', 'team', 'embed', 'pros_and_cons',
  'agenda', 'swot', 'quadrant', 'venn_diagram', 'chart', 'closing',
] as const;
export type Layout = typeof LayoutNames[number];

// --- Deck creation ---
export const CreateDeckSchema = z.object({
  title: z.string().min(1),
  heading_font: z.string().min(1).max(100).optional(),
  body_font: z.string().min(1).max(100).optional(),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  agent_name: z.string().min(1).max(100).optional(),
  slides: z.array(SlideSchema).min(1).max(50),
});
export type CreateDeckInput = z.infer<typeof CreateDeckSchema>;

// --- Deck update ---
const SlideUpdateSchema = z.object({
  index: z.number().int().min(0),
  content: z.record(z.unknown()),
});

const NewSlideSchema = z.object({
  layout: z.enum(LayoutNames),
  content: z.record(z.unknown()),
});

export const SlideOperationSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('delete'), index: z.number().int().min(0) }),
  z.object({ op: z.literal('insert'), index: z.number().int().min(0), slide: NewSlideSchema }),
  z.object({ op: z.literal('move'), from: z.number().int().min(0), to: z.number().int().min(0) }),
  z.object({ op: z.literal('replace'), index: z.number().int().min(0), slide: NewSlideSchema }),
]);
export type SlideOperation = z.infer<typeof SlideOperationSchema>;

export const UpdateDeckSchema = z.object({
  title: z.string().min(1).optional(),
  heading_font: z.string().min(1).max(100).optional(),
  body_font: z.string().min(1).max(100).optional(),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  slides: z.array(SlideUpdateSchema).optional(),
  slide_operations: z.array(SlideOperationSchema).max(50).optional(),
}).refine(
  (data) => data.title !== undefined || data.heading_font !== undefined || data.body_font !== undefined || data.accent_color !== undefined || data.slides !== undefined || data.slide_operations !== undefined,
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
  agent_name: z.string().nullable().optional(),
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

// --- Comments ---
export const AuthorTypeSchema = z.enum(['human', 'agent']);
export type AuthorType = z.infer<typeof AuthorTypeSchema>;

export const CommentMessageSchema = z.object({
  author_name: z.string().min(1),
  author_type: AuthorTypeSchema,
  body: z.string().min(1),
  created_at: z.string(),
});
export type CommentMessage = z.infer<typeof CommentMessageSchema>;

export const CommentSchema = z.object({
  id: z.string(),
  deck_id: z.string(),
  slide_id: z.string(),
  content_path: z.string().min(1),
  status: z.enum(['open', 'resolved']),
  messages: z.array(CommentMessageSchema),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Comment = z.infer<typeof CommentSchema>;

export const CreateCommentSchema = z.object({
  slide_id: z.string().min(1),
  content_path: z.string().min(1),
  author_name: z.string().min(1).max(100),
  author_type: AuthorTypeSchema.default('human'),
  body: z.string().min(1),
});
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

export const CreateReplySchema = z.object({
  author_name: z.string().min(1).max(100),
  author_type: AuthorTypeSchema.default('human'),
  body: z.string().min(1),
});
export type CreateReplyInput = z.infer<typeof CreateReplySchema>;

export const UpdateCommentSchema = z.object({
  status: z.enum(['open', 'resolved']),
});
export type UpdateCommentInput = z.infer<typeof UpdateCommentSchema>;

export const ListCommentsQuerySchema = z.object({
  status: z.enum(['open', 'resolved']).optional(),
  slide_id: z.string().optional(),
  since: z.string().optional(),
});
