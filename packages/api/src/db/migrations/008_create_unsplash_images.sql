CREATE TABLE IF NOT EXISTS unsplash_images (
  id TEXT PRIMARY KEY,
  unsplash_id TEXT NOT NULL,
  url_regular TEXT NOT NULL,
  url_small TEXT NOT NULL,
  url_thumb TEXT NOT NULL,
  alt_description TEXT,
  photographer_name TEXT NOT NULL,
  photographer_url TEXT NOT NULL,
  download_location TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
