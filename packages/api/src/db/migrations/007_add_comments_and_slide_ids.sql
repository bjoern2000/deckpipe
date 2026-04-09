-- Add agent_name to decks
ALTER TABLE decks ADD COLUMN IF NOT EXISTS agent_name TEXT DEFAULT NULL;

-- Backfill existing slides with stable slide_id (sld_ + 8 random chars)
-- Each slide in the JSONB array gets a unique slide_id if it doesn't have one.
DO $$
DECLARE
  r RECORD;
  updated_slides JSONB;
  slide JSONB;
  i INT;
BEGIN
  FOR r IN SELECT deck_id, slides FROM decks LOOP
    updated_slides := '[]'::jsonb;
    FOR i IN 0..jsonb_array_length(r.slides) - 1 LOOP
      slide := r.slides->i;
      IF NOT (slide ? 'slide_id') THEN
        slide := jsonb_set(slide, '{slide_id}', to_jsonb('sld_' || substr(md5(random()::text), 1, 8)));
      END IF;
      updated_slides := updated_slides || jsonb_build_array(slide);
    END LOOP;
    UPDATE decks SET slides = updated_slides WHERE deck_id = r.deck_id;
  END LOOP;
END $$;

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL REFERENCES decks(deck_id) ON DELETE CASCADE,
  slide_id TEXT NOT NULL,
  content_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_deck_id ON comments(deck_id);
CREATE INDEX IF NOT EXISTS idx_comments_deck_slide ON comments(deck_id, slide_id);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(deck_id, status);
