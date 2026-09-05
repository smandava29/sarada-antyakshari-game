PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS game_attempts (
  id INTEGER PRIMARY KEY,
  session_token_hash TEXT NOT NULL
    REFERENCES game_sessions(token_hash) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('guess', 'skip')),
  submitted_song_id TEXT REFERENCES song_catalog(id),
  was_correct INTEGER NOT NULL CHECK (was_correct IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(session_token_hash, attempt_number)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_game_attempts_session
  ON game_attempts(session_token_hash, attempt_number);
