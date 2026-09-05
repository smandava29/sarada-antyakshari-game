import type { AppConfig } from "../config";
import type { GameAction, GameRequestBody, MediaAsset } from "../types";
import { ApiError } from "../utils/errors";
import { validateIsoDate } from "../utils/date";

const ACTIONS = new Set<GameAction>([
  "start",
  "resume",
  "guess",
  "skip",
  "archive-bounds",
  "media-url",
  "result-media-urls",
]);

const MEDIA_ASSETS = new Set<MediaAsset>([
  "question",
  "preview",
  "cover",
]);

export function assertAllowedOrigin(request: Request, config: AppConfig): void {
  const origin = request.headers.get("Origin");
  if (!origin) return;

  const requestOrigin = new URL(request.url).origin;
  if (origin !== requestOrigin && !config.allowedOrigins.has(origin)) {
    throw new ApiError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed.");
  }
}

export async function readGameRequest(
  request: Request,
  config: AppConfig,
): Promise<GameRequestBody> {
  if (request.method !== "POST") {
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Only POST is supported.");
  }

  if (!(request.headers.get("Content-Type") ?? "").toLowerCase().includes("application/json")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "The request body must be JSON.");
  }

  const declaredLength = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > config.maxRequestBytes) {
    throw new ApiError(413, "REQUEST_TOO_LARGE", "The request body is too large.");
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > config.maxRequestBytes) {
    throw new ApiError(413, "REQUEST_TOO_LARGE", "The request body is too large.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError(400, "INVALID_REQUEST", "The request body must be an object.");
  }

  const body = parsed as Record<string, unknown>;
  if (typeof body.action !== "string" || !ACTIONS.has(body.action as GameAction)) {
    throw new ApiError(400, "INVALID_ACTION", "The requested action is not supported.");
  }
  return body as GameRequestBody;
}

export function optionalQuestionDate(body: GameRequestBody): string | undefined {
  if (body.questionDate === undefined) return undefined;
  return validateIsoDate(body.questionDate);
}

export function requireSessionToken(body: GameRequestBody): string {
  if (
    typeof body.sessionToken !== "string" ||
    body.sessionToken.length < 32 ||
    body.sessionToken.length > 128 ||
    !/^[A-Za-z0-9_-]+$/u.test(body.sessionToken)
  ) {
    throw new ApiError(400, "INVALID_SESSION_TOKEN", "A valid session token is required.");
  }
  return body.sessionToken;
}

export function requireSongId(body: GameRequestBody): string {
  if (typeof body.songId !== "string") {
    throw new ApiError(400, "INVALID_SONG", "A song ID is required.");
  }
  const value = body.songId.trim();
  if (!value || value.length > 128 || !/^[A-Za-z0-9-]+$/u.test(value)) {
    throw new ApiError(400, "INVALID_SONG", "The song ID is invalid.");
  }
  return value;
}

export type SongSelection =
  | { songId: string }
  | { songTitle: string; movieTitle: string | null };

export function requireSongSelection(body: GameRequestBody): SongSelection {
  if (body.songId !== undefined) return { songId: requireSongId(body) };
  if (typeof body.songTitle !== "string") {
    throw new ApiError(400, "INVALID_SONG", "A valid song selection is required.");
  }
  const songTitle = body.songTitle.trim();
  const movieTitle = body.movieTitle === null
    ? null
    : typeof body.movieTitle === "string"
      ? body.movieTitle.trim() || null
      : null;
  if (!songTitle || songTitle.length > 300 || (movieTitle?.length ?? 0) > 300) {
    throw new ApiError(400, "INVALID_SONG", "The song selection is invalid.");
  }
  return { songTitle, movieTitle };
}

export function requireMediaAsset(body: GameRequestBody): MediaAsset {
  if (typeof body.asset !== "string" || !MEDIA_ASSETS.has(body.asset as MediaAsset)) {
    throw new ApiError(400, "INVALID_MEDIA_ASSET", "The requested media asset is invalid.");
  }
  return body.asset as MediaAsset;
}
