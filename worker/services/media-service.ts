import {
  getSession,
  hasDailyGame,
} from "../repositories/game-repository";
import type { Env } from "../types";
import { nowEpochSeconds, todayInIndia, validateIsoDate } from "../utils/date";
import { ApiError } from "../utils/errors";
import { readMediaToken } from "../utils/media-token";
import { resolveAuthorizedMediaPath } from "../validation/media-path-validation";

function mediaError(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}

function defaultContentType(path: string): string {
  if (path.endsWith(".mp3")) return "audio/mpeg";
  if (path.endsWith(".m4a")) return "audio/mp4";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

async function serveR2Object(
  request: Request,
  env: Env,
  path: string,
): Promise<Response> {
  if (request.method === "HEAD") {
    const object = await env.SONGS.head(path);
    if (!object) return mediaError(404, "The requested media was not found.");

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", headers.get("Content-Type") ?? defaultContentType(path));
    headers.set("Content-Length", String(object.size));
    headers.set("ETag", object.httpEtag);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cross-Origin-Resource-Policy", "same-origin");
    return new Response(null, { status: 200, headers });
  }

  const object = await env.SONGS.get(path, { range: request.headers });
  if (!object) return mediaError(404, "The requested media was not found.");

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", headers.get("Content-Type") ?? defaultContentType(path));
  headers.set("ETag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Referrer-Policy", "no-referrer");

  if (request.headers.has("Range") && object.range) {
    const range = object.range as { offset: number; length: number };
    headers.set("Content-Length", String(range.length));
    headers.set(
      "Content-Range",
      `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`,
    );
    return new Response(object.body, { status: 206, headers });
  }

  headers.set("Content-Length", String(object.size));
  return new Response(object.body, { status: 200, headers });
}

export async function serveQuestionClip(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return mediaError(405, "Only GET and HEAD are supported.");
  }

  try {
    const date = validateIsoDate(new URL(request.url).searchParams.get("date"), "date");
    if (date > todayInIndia()) {
      return mediaError(404, "The requested media was not found.");
    }

    if (!(await hasDailyGame(env.DB, date))) {
      return mediaError(404, "The requested media was not found.");
    }

    return await serveR2Object(request, env, `question-clips/${date}.m4a`);
  } catch (error) {
    if (error instanceof ApiError) return mediaError(error.status, error.message);
    console.error("Unable to serve question clip", error);
    return mediaError(502, "The requested media is temporarily unavailable.");
  }
}

export async function serveSuggestions(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return mediaError(405, "Only GET and HEAD are supported.");
  }

  try {
    return await serveR2Object(request, env, "suggestions.json");
  } catch (error) {
    console.error("Unable to serve suggestions catalog", error);
    return mediaError(502, "The suggestions catalog is temporarily unavailable.");
  }
}

export async function serveMedia(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return mediaError(405, "Only GET and HEAD are supported.");
  }

  const token = new URL(request.url).searchParams.get("token");
  if (!token) return mediaError(400, "A media token is required.");

  try {
    const now = nowEpochSeconds();
    const payload = await readMediaToken(env.MEDIA_TOKEN_SECRET, token, now);
    const game = await getSession(env.DB, payload.sessionHash);
    if (!game) throw new ApiError(404, "SESSION_NOT_FOUND", "The game session was not found.");
    if (game.expiresAt.getTime() <= now * 1_000) {
      throw new ApiError(410, "SESSION_EXPIRED", "The game session has expired.");
    }

    const path = resolveAuthorizedMediaPath(game, payload.asset);
    return await serveR2Object(request, env, path);
  } catch (error) {
    if (error instanceof ApiError) return mediaError(error.status, error.message);
    console.error("Unable to serve media", error);
    return mediaError(502, "The requested media is temporarily unavailable.");
  }
}
