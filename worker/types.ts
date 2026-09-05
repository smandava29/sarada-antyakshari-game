export interface Env {
  DB: D1Database;
  SONGS: R2Bucket;
  ASSETS: Fetcher;
  API_RATE_LIMITER: RateLimit;
  START_RATE_LIMITER: RateLimit;
  MEDIA_RATE_LIMITER: RateLimit;
  MEDIA_TOKEN_SECRET: string;
  ALLOWED_ORIGINS?: string;
  MAX_ATTEMPTS?: string;
  SESSION_TTL_SECONDS?: string;
  MEDIA_TOKEN_TTL_SECONDS?: string;
  MAX_REQUEST_BYTES?: string;
}

export type GameStatus = "playing" | "won" | "lost";
export type MediaAsset = "question" | "preview" | "cover";

export interface GameRecord {
  tokenHash: string;
  questionDate: string;
  attemptsUsed: number;
  status: GameStatus;
  expiresAt: Date;
  version: number;
  answerSongId: string;
  songTitle: string;
  movieTitle: string | null;
  composer: string | null;
  releaseYear: number | null;
  releasedAt: string | null;
}

export interface SongRecord {
  id: string;
  songTitle: string;
  movieTitle: string | null;
}


export type AttemptType = "guess" | "skip";

export interface AttemptRecord {
  attemptNumber: number;
  attemptType: AttemptType;
  submittedSongId: string | null;
  wasCorrect: boolean;
  songTitle: string | null;
  movieTitle: string | null;
  createdAt: Date;
}

export type GameAction =
  | "start"
  | "resume"
  | "guess"
  | "skip"
  | "archive-bounds"
  | "media-url"
  | "result-media-urls";

export type GameRequestBody = Record<string, unknown> & { action: GameAction };
