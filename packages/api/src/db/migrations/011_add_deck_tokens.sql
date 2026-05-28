-- Deck-level design tokens: a flat { "--name": "value" } map injected into every
-- canvas slide's shadow root as `:host { … }`. Individually patchable via
-- update_deck so agents can flip one token without re-sending the whole stylesheet.

ALTER TABLE decks
  ADD COLUMN IF NOT EXISTS tokens JSONB;
