import type {
  AttemptRecord,
  AttemptType,
  GameRecord,
  GameStatus,
  SongRecord,
} from "../types";
import { ApiError } from "../utils/errors";

export type D1Boolean = 0 | 1;

function invalidRow(field: string): never {
  throw new ApiError(
    500,
    "INVALID_DATABASE_ROW",
    `The database contains an invalid ${field} value.`,
  );
}

export function fromD1Text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value) return invalidRow(field);
  return value;
}

export function fromD1NullableText(value: unknown, field: string): string | null {
  if (value === null) return null;
  return fromD1Text(value, field);
}

export function fromD1Integer(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    return invalidRow(field);
  }
  return value;
}

export function fromD1NullableInteger(value: unknown, field: string): number | null {
  if (value === null) return null;
  return fromD1Integer(value, field);
}

export function fromD1Boolean(value: unknown, field: string): boolean {
  const integer = fromD1Integer(value, field);
  if (integer !== 0 && integer !== 1) return invalidRow(field);
  return integer === 1;
}

export function toD1Boolean(value: boolean): D1Boolean {
  return value ? 1 : 0;
}

export function fromD1Timestamp(value: unknown, field: string): Date {
  const seconds = fromD1Integer(value, field);
  const date = new Date(seconds * 1_000);
  if (!Number.isFinite(date.getTime())) return invalidRow(field);
  return date;
}

export function toD1Timestamp(value: Date): number {
  const milliseconds = value.getTime();
  if (!Number.isFinite(milliseconds)) {
    throw new ApiError(500, "INVALID_APPLICATION_DATE", "An application timestamp is invalid.");
  }
  return Math.floor(milliseconds / 1_000);
}

function fromD1Enum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return invalidRow(field);
  }
  return value as T;
}

export interface RawGameRow {
  token_hash: unknown;
  question_date: unknown;
  attempts_used: unknown;
  status: unknown;
  expires_at: unknown;
  version: unknown;
  answer_song_id: unknown;
  song_title: unknown;
  movie_title: unknown;
  composer: unknown;
  release_year: unknown;
  released_at: unknown;
}

export function mapGameRow(row: RawGameRow | null): GameRecord | null {
  if (!row) return null;
  return {
    tokenHash: fromD1Text(row.token_hash, "token_hash"),
    questionDate: fromD1Text(row.question_date, "question_date"),
    attemptsUsed: fromD1Integer(row.attempts_used, "attempts_used"),
    status: fromD1Enum(row.status, ["playing", "won", "lost"], "status") as GameStatus,
    expiresAt: fromD1Timestamp(row.expires_at, "expires_at"),
    version: fromD1Integer(row.version, "version"),
    answerSongId: fromD1Text(row.answer_song_id, "answer_song_id"),
    songTitle: fromD1Text(row.song_title, "song_title"),
    movieTitle: fromD1NullableText(row.movie_title, "movie_title"),
    composer: fromD1NullableText(row.composer, "composer"),
    releaseYear: fromD1NullableInteger(row.release_year, "release_year"),
    releasedAt: fromD1NullableText(row.released_at, "released_at"),
  };
}

export interface RawSongRow {
  id: unknown;
  song_title: unknown;
  movie_title: unknown;
}

export function mapSongRow(row: RawSongRow | null): SongRecord | null {
  if (!row) return null;
  return {
    id: fromD1Text(row.id, "song id"),
    songTitle: fromD1Text(row.song_title, "song_title"),
    movieTitle: fromD1NullableText(row.movie_title, "movie_title"),
  };
}

export interface RawAttemptRow {
  attempt_number: unknown;
  attempt_type: unknown;
  submitted_song_id: unknown;
  was_correct: unknown;
  song_title: unknown;
  movie_title: unknown;
  created_at: unknown;
}

export function mapAttemptRow(row: RawAttemptRow): AttemptRecord {
  return {
    attemptNumber: fromD1Integer(row.attempt_number, "attempt_number"),
    attemptType: fromD1Enum(row.attempt_type, ["guess", "skip"], "attempt_type") as AttemptType,
    submittedSongId: fromD1NullableText(row.submitted_song_id, "submitted_song_id"),
    wasCorrect: fromD1Boolean(row.was_correct, "was_correct"),
    songTitle: fromD1NullableText(row.song_title, "attempt song_title"),
    movieTitle: fromD1NullableText(row.movie_title, "attempt movie_title"),
    createdAt: fromD1Timestamp(row.created_at, "attempt created_at"),
  };
}
