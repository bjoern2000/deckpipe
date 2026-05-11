-- Deck-level canvas support: global stylesheet and head entries (<link>/<script>/<style>)
-- shared by all canvas slides via shadow-root adoption.

ALTER TABLE decks
  ADD COLUMN IF NOT EXISTS stylesheet TEXT,
  ADD COLUMN IF NOT EXISTS head JSONB;
