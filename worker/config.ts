import { ApiError } from "./utils/errors";
import type { Env } from "./types";

export interface AppConfig {
  allowedOrigins: Set<string>;
  maxAttempts: number;
  sessionTtlSeconds: number;
  mediaTokenTtlSeconds: number;
  maxRequestBytes: number;
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ApiError(500, "INVALID_CONFIGURATION", `${name} is invalid.`);
  }
  return parsed;
}

export function getConfig(env: Env): AppConfig {
  return {
    allowedOrigins: new Set(
      (env.ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
    maxAttempts: boundedInteger(env.MAX_ATTEMPTS, 5, 1, 10, "MAX_ATTEMPTS"),
    sessionTtlSeconds: boundedInteger(
      env.SESSION_TTL_SECONDS,
      3_600,
      300,
      86_400,
      "SESSION_TTL_SECONDS",
    ),
    mediaTokenTtlSeconds: boundedInteger(
      env.MEDIA_TOKEN_TTL_SECONDS,
      300,
      30,
      900,
      "MEDIA_TOKEN_TTL_SECONDS",
    ),
    maxRequestBytes: boundedInteger(
      env.MAX_REQUEST_BYTES,
      16_384,
      1_024,
      65_536,
      "MAX_REQUEST_BYTES",
    ),
  };
}
