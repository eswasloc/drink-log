PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL,
  UNIQUE (provider, provider_user_id)
);

CREATE INDEX idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS oauth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_oauth_sessions_user_id ON oauth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires_at ON oauth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS sake_records (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  drink_type TEXT NOT NULL DEFAULT 'sake',
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  region TEXT,
  brewery TEXT,
  rice TEXT,
  sake_type TEXT,
  sake_meter_value TEXT,
  abv TEXT,
  volume TEXT,
  price TEXT,
  drink_again TEXT CHECK (drink_again IS NULL OR drink_again IN ('no', 'unsure', 'yes')),
  sweet_dry INTEGER CHECK (sweet_dry IS NULL OR sweet_dry BETWEEN 1 AND 5),
  aroma_intensity INTEGER CHECK (aroma_intensity IS NULL OR aroma_intensity BETWEEN 1 AND 3),
  acidity INTEGER CHECK (acidity IS NULL OR acidity BETWEEN 1 AND 3),
  clean_umami INTEGER CHECK (clean_umami IS NULL OR clean_umami BETWEEN 1 AND 3),
  one_line_note TEXT,
  place TEXT,
  consumed_date TEXT NOT NULL,
  companions TEXT,
  food_pairing TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sake_records_owner_id ON sake_records(owner_id);
CREATE INDEX idx_sake_records_consumed_date ON sake_records(consumed_date DESC);
CREATE INDEX idx_sake_records_updated_at ON sake_records(updated_at DESC);
CREATE INDEX idx_sake_records_drink_type ON sake_records(drink_type);

CREATE TABLE IF NOT EXISTS sake_images (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  image_key TEXT NOT NULL,
  thumbnail_key TEXT,
  mime_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (record_id) REFERENCES sake_records(id) ON DELETE CASCADE
);

CREATE INDEX idx_sake_images_owner_id ON sake_images(owner_id);
CREATE INDEX idx_sake_images_record_id ON sake_images(record_id);
CREATE INDEX idx_sake_images_display_order ON sake_images(record_id, display_order);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  drink_type TEXT NOT NULL DEFAULT 'sake',
  tag_group TEXT NOT NULL CHECK (tag_group IN ('taste', 'aroma', 'mood')),
  label TEXT NOT NULL CHECK (length(trim(label)) > 0),
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_tags_default_unique
  ON tags(drink_type, tag_group, label)
  WHERE owner_id IS NULL;

CREATE UNIQUE INDEX idx_tags_owner_unique
  ON tags(owner_id, drink_type, tag_group, label)
  WHERE owner_id IS NOT NULL;

CREATE INDEX idx_tags_owner_id ON tags(owner_id);
CREATE INDEX idx_tags_drink_type_group ON tags(drink_type, tag_group);

CREATE TABLE IF NOT EXISTS record_tags (
  record_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (record_id, tag_id),
  FOREIGN KEY (record_id) REFERENCES sake_records(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_record_tags_tag_id ON record_tags(tag_id);

INSERT OR IGNORE INTO tags (id, owner_id, drink_type, tag_group, label, is_default, created_at) VALUES
  ('tag_taste_fresh', NULL, 'sake', 'taste', '산뜻', 1, CURRENT_TIMESTAMP),
  ('tag_taste_umami', NULL, 'sake', 'taste', '감칠', 1, CURRENT_TIMESTAMP),
  ('tag_taste_soft', NULL, 'sake', 'taste', '부드러움', 1, CURRENT_TIMESTAMP),
  ('tag_taste_rich', NULL, 'sake', 'taste', '진함', 1, CURRENT_TIMESTAMP),
  ('tag_taste_clean', NULL, 'sake', 'taste', '깔끔함', 1, CURRENT_TIMESTAMP),
  ('tag_taste_bitter', NULL, 'sake', 'taste', '쌉쌀함', 1, CURRENT_TIMESTAMP),
  ('tag_taste_sweet', NULL, 'sake', 'taste', '달큼함', 1, CURRENT_TIMESTAMP),
  ('tag_aroma_koji', NULL, 'sake', 'aroma', '누룩', 1, CURRENT_TIMESTAMP),
  ('tag_aroma_rice', NULL, 'sake', 'aroma', '쌀', 1, CURRENT_TIMESTAMP),
  ('tag_aroma_fruit', NULL, 'sake', 'aroma', '과일', 1, CURRENT_TIMESTAMP),
  ('tag_aroma_flower', NULL, 'sake', 'aroma', '꽃', 1, CURRENT_TIMESTAMP),
  ('tag_aroma_apple', NULL, 'sake', 'aroma', '사과', 1, CURRENT_TIMESTAMP),
  ('tag_aroma_pineapple', NULL, 'sake', 'aroma', '파인애플', 1, CURRENT_TIMESTAMP),
  ('tag_aroma_melon', NULL, 'sake', 'aroma', '멜론', 1, CURRENT_TIMESTAMP),
  ('tag_aroma_pear', NULL, 'sake', 'aroma', '배', 1, CURRENT_TIMESTAMP),
  ('tag_aroma_herb', NULL, 'sake', 'aroma', '허브', 1, CURRENT_TIMESTAMP),
  ('tag_aroma_yogurt', NULL, 'sake', 'aroma', '요구르트', 1, CURRENT_TIMESTAMP),
  ('tag_aroma_nut', NULL, 'sake', 'aroma', '견과', 1, CURRENT_TIMESTAMP),
  ('tag_mood_unique', NULL, 'sake', 'mood', '독특', 1, CURRENT_TIMESTAMP),
  ('tag_mood_easy', NULL, 'sake', 'mood', '무난', 1, CURRENT_TIMESTAMP),
  ('tag_mood_food', NULL, 'sake', 'mood', '안주랑 먹기 좋음', 1, CURRENT_TIMESTAMP),
  ('tag_mood_aperitif', NULL, 'sake', 'mood', '식전주', 1, CURRENT_TIMESTAMP);
