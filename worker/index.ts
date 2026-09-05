import { getConfig } from "./config";
import { deleteExpiredSessions } from "./repositories/game-repository";
import { routeGameRequest } from "./router";
import { serveMedia, serveQuestionClip, serveSuggestions } from "./services/media-service";
import type { Env } from "./types";
import {
  errorResponse,
  rateLimitResponse,
  successResponse,
  withSecurityHeaders,
} from "./utils/http";
import {
  clientIdentifier,
  enforceCloudflareRateLimit,
  enforceLocalRateLimit,
} from "./utils/rate-limit";
import { assertAllowedOrigin, readGameRequest } from "./validation/request-validation";

async function handleGameApi(request: Request, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const config = getConfig(env);
    assertAllowedOrigin(request, config);
    const clientId = clientIdentifier(request);
    await enforceCloudflareRateLimit(env.API_RATE_LIMITER, clientId);
    enforceLocalRateLimit("api", clientId, { limit: 90, windowSeconds: 60 });
    const body = await readGameRequest(request, config);

    if (body.action === "start") {
      await enforceCloudflareRateLimit(env.START_RATE_LIMITER, clientId);
      enforceLocalRateLimit("start", clientId, { limit: 8, windowSeconds: 60 });
    } else if (body.action === "guess" || body.action === "skip") {
      enforceLocalRateLimit("attempt", clientId, { limit: 30, windowSeconds: 60 });
    }

    return successResponse(await routeGameRequest(env, config, body), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

async function handleRateLimitedRoute(
  request: Request,
  env: Env,
  scope: string,
  policy: { limit: number; windowSeconds: number },
  handler: (request: Request, env: Env) => Promise<Response>,
): Promise<Response> {
  try {
    const clientId = clientIdentifier(request);
    await enforceCloudflareRateLimit(env.MEDIA_RATE_LIMITER, `${scope}:${clientId}`);
    enforceLocalRateLimit(scope, clientId, policy);
    return await handler(request, env);
  } catch (error) {
    return rateLimitResponse(error);
  }
}

function optionsResponse(request: Request, env: Env): Response {
  const origin = request.headers.get("Origin");
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  });
  if (origin) {
    const config = getConfig(env);
    if (origin === new URL(request.url).origin || config.allowedOrigins.has(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
    }
  }
  return new Response(null, { status: 204, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/game") {
      return request.method === "OPTIONS"
        ? optionsResponse(request, env)
        : handleGameApi(request, env);
    }

    if (url.pathname === "/api/media") {
      return handleRateLimitedRoute(
        request,
        env,
        "media",
        { limit: 240, windowSeconds: 60 },
        serveMedia,
      );
    }

    if (url.pathname === "/api/question-clip") {
      return handleRateLimitedRoute(
        request,
        env,
        "question-clip",
        { limit: 90, windowSeconds: 60 },
        serveQuestionClip,
      );
    }

    if (url.pathname === "/api/suggestions") {
      return handleRateLimitedRoute(
        request,
        env,
        "suggestions",
        { limit: 30, windowSeconds: 60 },
        serveSuggestions,
      );
    }

    if (url.pathname.startsWith("/api/")) {
      return new Response("Not found", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const removed = await deleteExpiredSessions(env.DB, new Date());
    console.log("Expired session cleanup complete", { removed });
  },
} satisfies ExportedHandler<Env>;
