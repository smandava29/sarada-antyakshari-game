import type {
  AttemptRecord,
  AttemptType,
  GameRecord,
  GameStatus,
  SongRecord,
} from "../types";
import {
  type RawAttemptRow,
  type RawGameRow,
  type RawSongRow,
  fromD1NullableText,
  mapAttemptRow,
  mapGameRow,
  mapSongRow,
  toD1Boolean,
  toD1Timestamp,
} from "./d1-types";

const SESSION_SELECT = `
  SELECT
    s.token_hash,
    s.question_date,
    s.attempts_used,
    s.status,
    s.expires_at,
    s.version,
    g.answer_song_id,
    c.song_title,
    c.movie_title,
    c.composer,
    c.release_year,
    c.released_at
  FROM game_sessions AS s
  JOIN daily_games AS g ON g.question_date = s.question_date
  JOIN song_catalog AS c ON c.id = g.answer_song_id
`;

export async function hasDailyGame(
  db: D1Database,
  questionDate: string,
): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 AS available FROM daily_games WHERE question_date = ?1 LIMIT 1`)
    .bind(questionDate)
    .first<{ available: number }>();
  return row?.available === 1;
}

export async function createSession(
  db: D1Database,
  tokenHash: string,
  questionDate: string,
  expiresAt: Date,
  createdAt: Date,
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO game_sessions (
        token_hash, question_date, attempts_used, status,
        expires_at, version, created_at
      ) VALUES (?1, ?2, 0, 'playing', ?3, 0, ?4)
    `)
    .bind(tokenHash, questionDate, toD1Timestamp(expiresAt), toD1Timestamp(createdAt))
    .run();
}

export async function getSession(
  db: D1Database,
  tokenHash: string,
): Promise<GameRecord | null> {
  const row = await db
    .prepare(`${SESSION_SELECT} WHERE s.token_hash = ?1 LIMIT 1`)
    .bind(tokenHash)
    .first<RawGameRow>();
  return mapGameRow(row);
}

export async function findSongById(
  db: D1Database,
  songId: string,
): Promise<SongRecord | null> {
  const row = await db
    .prepare(`
      SELECT id, song_title, movie_title
      FROM song_catalog
      WHERE id = ?1
      LIMIT 1
    `)
    .bind(songId)
    .first<RawSongRow>();
  return mapSongRow(row);
}

export async function findSongsByDetails(
  db: D1Database,
  songTitle: string,
  movieTitle: string | null,
): Promise<SongRecord[]> {
  const result = await db
    .prepare(`
      SELECT id, song_title, movie_title
      FROM song_catalog
      WHERE song_title = ?1 COLLATE NOCASE
        AND ((movie_title IS NULL AND ?2 IS NULL) OR movie_title = ?2 COLLATE NOCASE)
      ORDER BY id
      LIMIT 2
    `)
    .bind(songTitle, movieTitle)
    .all<RawSongRow>();
  return result.results.map((row) => {
    const song = mapSongRow(row);
    if (!song) throw new Error("Unexpected empty song row.");
    return song;
  });
}

export async function recordAttempt(
  db: D1Database,
  current: GameRecord,
  nextStatus: GameStatus,
  completedAt: Date | null,
  attemptType: AttemptType,
  submittedSongId: string | null,
  wasCorrect: boolean,
  attemptedAt: Date,
): Promise<GameRecord | null> {
  const update = db.prepare(`
      UPDATE game_sessions
      SET
        attempts_used = attempts_used + 1,
        status = ?1,
        version = version + 1,
        completed_at = ?2
      WHERE
        token_hash = ?3
        AND version = ?4
        AND attempts_used = ?5
        AND status = 'playing'
        AND expires_at > ?6
    `)
    .bind(
      nextStatus,
      completedAt ? toD1Timestamp(completedAt) : null,
      current.tokenHash,
      current.version,
      current.attemptsUsed,
      toD1Timestamp(attemptedAt),
    );

  const insertAttempt = db.prepare(`
      INSERT INTO game_attempts (
        session_token_hash, attempt_number, attempt_type,
        submitted_song_id, was_correct, created_at
      )
      SELECT ?1, ?2, ?3, ?4, ?5, ?6
      WHERE EXISTS (
        SELECT 1
        FROM game_sessions
        WHERE token_hash = ?1
          AND version = ?7
          AND attempts_used = ?2
      )
      AND NOT EXISTS (
        SELECT 1
        FROM game_attempts
        WHERE session_token_hash = ?1 AND attempt_number = ?2
      )
    `)
    .bind(
      current.tokenHash,
      current.attemptsUsed + 1,
      attemptType,
      submittedSongId,
      toD1Boolean(wasCorrect),
      toD1Timestamp(attemptedAt),
      current.version + 1,
    );

  const [result] = await db.batch([update, insertAttempt]);

  if (result.meta.changes !== 1) return null;
  return getSession(db, current.tokenHash);
}

export async function getAttemptHistory(
  db: D1Database,
  tokenHash: string,
): Promise<AttemptRecord[]> {
  const result = await db
    .prepare(`
      SELECT
        a.attempt_number,
        a.attempt_type,
        a.submitted_song_id,
        a.was_correct,
        c.song_title,
        c.movie_title,
        a.created_at
      FROM game_attempts AS a
      LEFT JOIN song_catalog AS c ON c.id = a.submitted_song_id
      WHERE a.session_token_hash = ?1
      ORDER BY a.attempt_number ASC
    `)
    .bind(tokenHash)
    .all<RawAttemptRow>();
  return result.results.map(mapAttemptRow);
}

export async function getAttempt(
  db: D1Database,
  tokenHash: string,
  attemptNumber: number,
): Promise<AttemptRecord | null> {
  const row = await db
    .prepare(`
      SELECT
        a.attempt_number,
        a.attempt_type,
        a.submitted_song_id,
        a.was_correct,
        c.song_title,
        c.movie_title,
        a.created_at
      FROM game_attempts AS a
      LEFT JOIN song_catalog AS c ON c.id = a.submitted_song_id
      WHERE a.session_token_hash = ?1 AND a.attempt_number = ?2
      LIMIT 1
    `)
    .bind(tokenHash, attemptNumber)
    .first<RawAttemptRow>();
  return row ? mapAttemptRow(row) : null;
}

export async function getArchiveBounds(
  db: D1Database,
  latestAllowedDate: string,
): Promise<{ earliest_date: string | null; latest_date: string | null }> {
  const row = await db
    .prepare(`
      SELECT
        MIN(question_date) AS earliest_date,
        MAX(question_date) AS latest_date
      FROM daily_games
      WHERE question_date <= ?1
    `)
    .bind(latestAllowedDate)
    .first<{ earliest_date: string | null; latest_date: string | null }>();

  return {
    earliest_date: fromD1NullableText(row?.earliest_date ?? null, "earliest_date"),
    latest_date: fromD1NullableText(row?.latest_date ?? null, "latest_date"),
  };
}

export async function deleteExpiredSessions(
  db: D1Database,
  olderThan: Date,
): Promise<number> {
  const result = await db
    .prepare("DELETE FROM game_sessions WHERE expires_at < ?1")
    .bind(toD1Timestamp(olderThan))
    .run();
  return result.meta.changes;
}
