-- PROVELMICS Database Schema for Cloudflare D1
-- Run with: wrangler d1 execute provelmics-db --file=./db/schema.sql

-- Users table (synced from Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  pen_name TEXT,
  photo_url TEXT,
  bio TEXT,
  role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Novels table
CREATE TABLE IF NOT EXISTS novels (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  synopsis TEXT,
  release_date TEXT,
  genre TEXT DEFAULT '[]',
  rating_avg REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  author_id TEXT NOT NULL,
  content TEXT DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  cover_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Comics table
CREATE TABLE IF NOT EXISTS comics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  synopsis TEXT,
  release_date TEXT,
  genre TEXT DEFAULT '[]',
  rating_avg REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  author_id TEXT NOT NULL,
  cover_url TEXT,
  image_urls TEXT DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Ratings table
CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK(content_type IN ('novel', 'comic')),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, content_id, content_type),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK(content_type IN ('novel', 'comic')),
  chapter INTEGER DEFAULT 0,
  progress_percent REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, content_id, content_type),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Reading progress table
CREATE TABLE IF NOT EXISTS reading_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  novel_id TEXT NOT NULL,
  chapter_index INTEGER DEFAULT 0,
  scroll_position INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, novel_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (novel_id) REFERENCES novels(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_novels_status ON novels(status);
CREATE INDEX IF NOT EXISTS idx_novels_author ON novels(author_id);
CREATE INDEX IF NOT EXISTS idx_comics_status ON comics(status);
CREATE INDEX IF NOT EXISTS idx_comics_author ON comics(author_id);
CREATE INDEX IF NOT EXISTS idx_ratings_content ON ratings(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_progress_user ON reading_progress(user_id);
