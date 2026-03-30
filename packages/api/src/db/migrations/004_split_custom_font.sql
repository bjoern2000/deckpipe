ALTER TABLE decks ADD COLUMN IF NOT EXISTS heading_font TEXT;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS body_font TEXT;

UPDATE decks SET heading_font = custom_font, body_font = custom_font WHERE custom_font IS NOT NULL;

ALTER TABLE decks DROP COLUMN IF EXISTS custom_font;
