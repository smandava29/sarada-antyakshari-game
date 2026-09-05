import { ApiError } from "./errors";

interface WindowCounter {
  count: number;
  resetAt: number;
}

export interface LocalRateLimitPolicy {
  limit: number;
  windowSeconds: number;
}

const counters = new Map<string, WindowCounter>();
const MAX_COUNTERS = 10_000;

export function clientIdentifier(request: Request): string {
  return request.headers.get("CF-Connecting-IP")?.trim() || "local-client";
}

function pruneExpiredCounters(now: number): void {
  if (counters.size < MAX_COUNTERS) return;
  for (const [key, counter] of counters) {
    if (counter.resetAt <= now) counters.delete(key);
  }
  while (counters.size >= MAX_COUNTERS) {
    const oldestKey = counters.keys().next().value as string | undefined;
    if (!oldestKey) break;
    counters.delete(oldestKey);
  }
}

export function enforceLocalRateLimit(
  scope: string,
  clientId: string,
  policy: LocalRateLimitPolicy,
  now = Date.now(),
): void {
  pruneExpiredCounters(now);
  const key = `${scope}:${clientId}`;
  const existing = counters.get(key);

  if (!existing || existing.resetAt <= now) {
    counters.set(key, {
      count: 1,
      resetAt: now + policy.windowSeconds * 1_000,
    });
    return;
  }

  existing.count += 1;
  if (existing.count > policy.limit) {
    throw new ApiError(429, "RATE_LIMITED", "Too many requests. Please try again shortly.");
  }
}

export async function enforceCloudflareRateLimit(
  limiter: RateLimit,
  key: string,
): Promise<void> {
  const outcome = await limiter.limit({ key });
  if (!outcome.success) {
    throw new ApiError(429, "RATE_LIMITED", "Too many requests. Please try again shortly.");
  }
}

export function resetLocalRateLimitsForTests(): void {
  counters.clear();
}
