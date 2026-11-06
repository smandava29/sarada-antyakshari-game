import { asApiError } from "./errors";

export function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders?: HeadersInit,
): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(JSON.stringify(body), { status, headers });
}

export function successResponse(data: unknown, requestId: string): Response {
  return jsonResponse({ success: true, requestId, data }, 200);
}

export function errorResponse(error: unknown, requestId: string): Response {
  const apiError = asApiError(error);
  const response = jsonResponse(
    {
      success: false,
      requestId,
      error: { code: apiError.code, message: apiError.message },
    },
    apiError.status,
  );
  if (apiError.status === 429) response.headers.set("Retry-After", "60");
  return response;
}

export function rateLimitResponse(error: unknown): Response {
  const apiError = asApiError(error);
  const response = new Response(apiError.message, {
    status: apiError.status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Retry-After": "60",
      "X-Content-Type-Options": "nosniff",
    },
  });
  return response;
}

export function withSecurityHeaders(response: Response, cspNonce?: string): Response {
  const secured = new Response(response.body, response);
  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  secured.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  secured.headers.set("X-Frame-Options", "SAMEORIGIN");
  const scriptSource = cspNonce
    ? `'nonce-${cspNonce}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https: http:`
    : "'self'";
  secured.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src ${scriptSource}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' https:; frame-src https:; font-src 'self' data:; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests`,
  );
  return secured;
}
