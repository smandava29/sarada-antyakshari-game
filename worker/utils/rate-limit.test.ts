import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enforceCloudflareRateLimit,
  enforceLocalRateLimit,
  resetLocalRateLimitsForTests,
} from "./rate-limit";

describe("application rate limiter", () => {
  beforeEach(resetLocalRateLimitsForTests);

  it("rejects requests above the limit within one window", () => {
    enforceLocalRateLimit("start", "client-a", { limit: 2, windowSeconds: 60 }, 1_000);
    enforceLocalRateLimit("start", "client-a", { limit: 2, windowSeconds: 60 }, 1_001);
    expect(() =>
      enforceLocalRateLimit("start", "client-a", { limit: 2, windowSeconds: 60 }, 1_002),
    ).toThrow("Too many requests");
  });

  it("isolates clients and resets expired windows", () => {
    enforceLocalRateLimit("media", "client-a", { limit: 1, windowSeconds: 10 }, 1_000);
    enforceLocalRateLimit("media", "client-b", { limit: 1, windowSeconds: 10 }, 1_001);
    expect(() =>
      enforceLocalRateLimit("media", "client-a", { limit: 1, windowSeconds: 10 }, 11_001),
    ).not.toThrow();
  });

  it("rejects requests denied by the Cloudflare limiter", async () => {
    const limiter = {
      limit: vi.fn(async () => ({ success: false })),
    } as RateLimit;

    await expect(enforceCloudflareRateLimit(limiter, "client-a"))
      .rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
  });
});
