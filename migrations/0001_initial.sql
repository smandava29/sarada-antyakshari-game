PRAGMA foreign_keys = ON;

-- Baseline matching the production D1 schema validated on 2026-09-04.
CREATE TABLE IF NOT EXISTS song_catalog (
  id TEXT PRIMARY KEY NOT NULL,
  song_title TEXT NOT NULL CHECK (length(trim(song_title)) > 0),
  movie_title TEXT,
  composer TEXT,
  release_year INTEGER
    CHECK (release_year IS NULL OR release_year BETWEEN 1900 AND 2500),
  released_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS song_catalog_set_updated_at
AFTER UPDATE ON song_catalog
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE song_catalog SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TABLE IF NOT EXISTS daily_games (
  question_date TEXT PRIMARY KEY NOT NULL,
  answer_song_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS game_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL CHECK (length(token_hash) = 64),
  question_date TEXT NOT NULL REFERENCES daily_games(question_date),
  attempts_used INTEGER NOT NULL DEFAULT 0 CHECK (attempts_used BETWEEN 0 AND 10),
  status TEXT NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'won', 'lost')),
  expires_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER
) STRICT;
