export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  console.error("Unhandled game API error", error);
  return new ApiError(
    500,
    "INTERNAL_ERROR",
    "The game service encountered an unexpected error.",
  );
}
