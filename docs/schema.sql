CREATE TABLE users (
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

CREATE TABLE bottles (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  abv REAL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_bottles_owner_id ON bottles(owner_id);
CREATE INDEX idx_bottles_created_at ON bottles(created_at DESC);
CREATE INDEX idx_bottles_type ON bottles(type);

CREATE TABLE bottle_images (
  id TEXT PRIMARY KEY,
  bottle_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  image_key TEXT NOT NULL,
  thumbnail_key TEXT,
  mime_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bottle_id) REFERENCES bottles(id) ON DELETE CASCADE
);

CREATE INDEX idx_bottle_images_bottle_id ON bottle_images(bottle_id);
CREATE INDEX idx_bottle_images_owner_id ON bottle_images(owner_id);
CREATE INDEX idx_bottle_images_created_at ON bottle_images(created_at);

CREATE TABLE sensory_notes (
  bottle_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  profile TEXT NOT NULL,
  sections_json TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bottle_id) REFERENCES bottles(id) ON DELETE CASCADE
);

CREATE INDEX idx_sensory_notes_owner_id ON sensory_notes(owner_id);
CREATE INDEX idx_sensory_notes_profile ON sensory_notes(profile);
