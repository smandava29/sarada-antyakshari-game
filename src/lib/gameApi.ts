import type {
  ArchiveBounds,
  AttemptResponse,
  GameApiErrorEnvelope,
  GameApiEnvelope,
  GameState,
  MediaAsset,
  ResultMediaBundle,
  SignedMedia,
  SongSuggestion,
  StartGameState,
} from "../types/game";

export class GameApiError extends Error {
  constructor(
    message: string,
    readonly code = "REQUEST_FAILED",
    readonly status = 0,
  ) {
    super(message);
    this.name = "GameApiError";
  }
}

const endpoint = "/api/game";
const inFlight = new Map<string, Promise<unknown>>();
let archiveBoundsPromise: Promise<ArchiveBounds> | null = null;

interface ResultMediaApiResponse {
  cover?: unknown;
  preview?: unknown;
}

function isSignedMedia(value: unknown): value is SignedMedia {
  if (
    typeof value !== "object" ||
    value === null ||
    !("signedUrl" in value) ||
    typeof value.signedUrl !== "string"
  ) {
    return false;
  }

  try {
    const url = new URL(value.signedUrl, "https://same-origin.invalid");
    return (
      url.origin === "https://same-origin.invalid" &&
      (
        (url.pathname === "/api/media" && Boolean(url.searchParams.get("token"))) ||
        (url.pathname === "/api/question-clip" && Boolean(url.searchParams.get("date")))
      )
    );
  } catch {
    return false;
  }
}

function requireSignedMedia(value: unknown): SignedMedia {
  if (!isSignedMedia(value)) {
    throw new GameApiError(
      "The media URL response is invalid.",
      "MEDIA_UNAVAILABLE",
    );
  }
  return value;
}

function stableKey(body: Record<string, unknown>): string {
  return JSON.stringify(
    Object.entries(body).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function offlineError(): GameApiError {
  return new GameApiError(
    "You appear to be offline. Reconnect and try again.",
    "NETWORK_OFFLINE",
  );
}

async function request<T>(body: Record<string, unknown>): Promise<T> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw offlineError();
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new GameApiError(
      error instanceof Error && error.name === "AbortError"
        ? "The game request timed out. Please try again."
        : "Unable to reach the game server. Check your connection and try again.",
      error instanceof Error && error.name === "AbortError"
        ? "REQUEST_TIMEOUT"
        : "NETWORK_ERROR",
    );
  }

  let payload: GameApiEnvelope<T> | GameApiErrorEnvelope | null = null;
  try {
    payload = (await response.json()) as
      GameApiEnvelope<T> | GameApiErrorEnvelope;
  } catch {
    // Platform errors are not guaranteed to use the application envelope.
  }

  if (!response.ok || !payload?.success) {
    const apiError = payload && "error" in payload ? payload.error : null;
    throw new GameApiError(
      apiError?.message ?? `The game server returned HTTP ${response.status}.`,
      apiError?.code ?? "REQUEST_FAILED",
      response.status,
    );
  }

  return payload.data;
}

function invokeDeduped<T>(body: Record<string, unknown>): Promise<T> {
  const key = stableKey(body);
  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = request<T>(body).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

export const gameApi = {
  start(questionDate?: string): Promise<StartGameState> {
    return invokeDeduped({
      action: "start",
      ...(questionDate ? { questionDate } : {}),
    });
  },

  resume(sessionToken: string): Promise<GameState> {
    return invokeDeduped({ action: "resume", sessionToken });
  },

  guess(sessionToken: string, song: SongSuggestion): Promise<AttemptResponse> {
    return request({
      action: "guess",
      sessionToken,
      ...(song.id ? { songId: song.id } : {
        songTitle: song.songTitle,
        movieTitle: song.movieTitle,
      }),
    });
  },

  skip(sessionToken: string): Promise<AttemptResponse> {
    return request({ action: "skip", sessionToken });
  },

  archiveBounds(): Promise<ArchiveBounds> {
    archiveBoundsPromise ??= invokeDeduped<ArchiveBounds>({
      action: "archive-bounds",
    }).catch((error: unknown) => {
      archiveBoundsPromise = null;
      throw error;
    });
    return archiveBoundsPromise;
  },

  async mediaUrl(
    sessionToken: string,
    asset: MediaAsset,
  ): Promise<SignedMedia> {
    const media = await invokeDeduped<unknown>({
      action: "media-url",
      sessionToken,
      asset,
    });
    return requireSignedMedia(media);
  },

  async resultMediaUrls(sessionToken: string): Promise<ResultMediaBundle> {
    const media = await invokeDeduped<ResultMediaApiResponse>({
      action: "result-media-urls",
      sessionToken,
    });

    if (!isSignedMedia(media.cover) || !isSignedMedia(media.preview)) {
      throw new GameApiError(
        "The result media is incomplete.",
        "MEDIA_UNAVAILABLE",
      );
    }

    return {
      cover: media.cover,
      preview: media.preview,
    };
  },
};
