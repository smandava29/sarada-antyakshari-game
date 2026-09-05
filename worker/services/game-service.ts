import type { AppConfig } from "../config";
import {
  createSession,
  findSongById,
  findSongsByDetails,
  getAttempt,
  getAttemptHistory,
  getArchiveBounds,
  hasDailyGame,
  getSession,
  recordAttempt,
} from "../repositories/game-repository";
import type {
  AttemptRecord,
  AttemptType,
  Env,
  GameRecord,
  GameStatus,
  MediaAsset,
} from "../types";
import { toD1Timestamp } from "../repositories/d1-types";
import { createSessionToken, hashSessionToken } from "../utils/crypto";
import { nowEpochSeconds, previousIsoDate, todayInIndia } from "../utils/date";
import { ApiError } from "../utils/errors";
import { createMediaToken } from "../utils/media-token";
import { resolveAuthorizedMediaPath } from "../validation/media-path-validation";
import type { SongSelection } from "../validation/request-validation";

interface SignedMedia {
  signedUrl: string;
}

function assertSessionActive(game: GameRecord, now = new Date()): void {
  if (game.expiresAt.getTime() <= now.getTime()) {
    throw new ApiError(410, "SESSION_EXPIRED", "The game session has expired.");
  }
}

function requireSession(game: GameRecord | null): GameRecord {
  if (!game) {
    throw new ApiError(404, "SESSION_NOT_FOUND", "The game session was not found.");
  }
  assertSessionActive(game);
  return game;
}

async function mediaReference(
  env: Env,
  config: AppConfig,
  game: GameRecord,
  asset: MediaAsset,
): Promise<SignedMedia> {
  if (asset === "question") {
    return {
      signedUrl: `/api/question-clip?date=${encodeURIComponent(game.questionDate)}`,
    };
  }

  resolveAuthorizedMediaPath(game, asset);
  const now = nowEpochSeconds();
  const expiresAt = Math.min(
    toD1Timestamp(game.expiresAt),
    now + config.mediaTokenTtlSeconds,
  );
  const token = await createMediaToken(
    env.MEDIA_TOKEN_SECRET,
    game.tokenHash,
    asset,
    expiresAt,
  );
  return { signedUrl: `/api/media?token=${encodeURIComponent(token)}` };
}

async function resultMediaBundle(env: Env, config: AppConfig, game: GameRecord) {
  if (game.status === "playing") {
    throw new ApiError(
      403,
      "MEDIA_NOT_AVAILABLE",
      "Result media is available after the game ends.",
    );
  }
  const [cover, preview] = await Promise.all([
    mediaReference(env, config, game, "cover"),
    mediaReference(env, config, game, "preview"),
  ]);
  return { cover, preview };
}

function publicAnswer(game: GameRecord) {
  if (game.status === "playing") return null;
  return {
    songTitle: game.songTitle,
    movieTitle: game.movieTitle,
    composer: game.composer,
    releaseYear: game.releaseYear,
    releasedAt: game.releasedAt,
  };
}

function baseGame(game: GameRecord, config: AppConfig) {
  return {
    questionDate: game.questionDate,
    status: game.status,
    attemptsUsed: game.attemptsUsed,
    maxAttempts: config.maxAttempts,
    expiresAt: game.expiresAt.toISOString(),
    questionMedia: null,
    answer: null,
    resultMedia: null,
    history: [],
  };
}

function publicAttempt(attempt: AttemptRecord) {
  return {
    attemptNumber: attempt.attemptNumber,
    attemptType: attempt.attemptType,
    submittedSongId: attempt.submittedSongId,
    wasCorrect: attempt.wasCorrect,
    songTitle: attempt.songTitle,
    movieTitle: attempt.movieTitle,
    createdAt: attempt.createdAt.toISOString(),
  };
}

export async function startGame(
  env: Env,
  config: AppConfig,
  requestedDate?: string,
) {
  const today = todayInIndia();
  const questionDate = requestedDate ?? today;
  if (questionDate > today) {
    throw new ApiError(404, "GAME_NOT_AVAILABLE", "The requested game is not available.");
  }

  if (!(await hasDailyGame(env.DB, questionDate))) {
    throw new ApiError(404, "GAME_NOT_AVAILABLE", "The requested game is not available.");
  }

  const sessionToken = createSessionToken();
  const tokenHash = await hashSessionToken(sessionToken);
  const now = new Date();
  await createSession(
    env.DB,
    tokenHash,
    questionDate,
    new Date(now.getTime() + config.sessionTtlSeconds * 1_000),
    now,
  );
  const game = requireSession(await getSession(env.DB, tokenHash));
  const questionMedia = await mediaReference(env, config, game, "question");

  return {
    ...baseGame(game, config),
    sessionToken,
    questionMedia,
  };
}

export async function resumeGame(
  env: Env,
  config: AppConfig,
  sessionToken: string,
) {
  const game = requireSession(await getSession(env.DB, await hashSessionToken(sessionToken)));
  const history = (await getAttemptHistory(env.DB, game.tokenHash)).map(publicAttempt);

  if (game.status === "playing") {
    const questionMedia = await mediaReference(env, config, game, "question");
    return { ...baseGame(game, config), questionMedia, history };
  }

  return {
    ...baseGame(game, config),
    answer: publicAnswer(game),
    resultMedia: await resultMediaBundle(env, config, game),
    history,
  };
}

async function loadPlayingGame(env: Env, sessionToken: string): Promise<GameRecord> {
  const game = requireSession(await getSession(env.DB, await hashSessionToken(sessionToken)));
  if (game.status !== "playing") {
    throw new ApiError(409, "GAME_ALREADY_COMPLETED", "This game has already been completed.");
  }
  return game;
}

async function finishAttempt(
  env: Env,
  config: AppConfig,
  game: GameRecord,
  attemptType: AttemptType,
  submittedSongId: string | null,
  wasCorrect: boolean,
) {
  if (game.attemptsUsed >= config.maxAttempts) {
    throw new ApiError(409, "ATTEMPT_LIMIT_REACHED", "No attempts remain.");
  }

  const attemptsUsed = game.attemptsUsed + 1;
  const status: GameStatus = wasCorrect
    ? "won"
    : attemptsUsed >= config.maxAttempts
      ? "lost"
      : "playing";
  const attemptedAt = new Date();
  const updated = await recordAttempt(
    env.DB,
    game,
    status,
    status === "playing" ? null : attemptedAt,
    attemptType,
    submittedSongId,
    wasCorrect,
    attemptedAt,
  );
  if (!updated) {
    throw new ApiError(
      409,
      "ATTEMPT_CONFLICT",
      "Another attempt changed this game. Refresh and try again.",
    );
  }

  const recordedAttempt = await getAttempt(env.DB, updated.tokenHash, updated.attemptsUsed);
  if (!recordedAttempt) {
    throw new ApiError(500, "ATTEMPT_NOT_RECORDED", "The attempt history could not be loaded.");
  }
  const attempt = publicAttempt(recordedAttempt);

  if (updated.status === "playing") {
    return { status: updated.status, attemptsUsed: updated.attemptsUsed, attempt };
  }
  return {
    status: updated.status,
    attemptsUsed: updated.attemptsUsed,
    attempt,
    answer: publicAnswer(updated),
    resultMedia: await resultMediaBundle(env, config, updated),
  };
}

export async function recordGuess(
  env: Env,
  config: AppConfig,
  sessionToken: string,
  selection: SongSelection,
) {
  const game = await loadPlayingGame(env, sessionToken);
  const selectedSong = "songId" in selection
    ? await findSongById(env.DB, selection.songId)
    : await findSongsByDetails(env.DB, selection.songTitle, selection.movieTitle).then((songs) => {
        if (songs.length > 1) {
          throw new ApiError(409, "AMBIGUOUS_SONG", "This song selection is ambiguous.");
        }
        return songs[0] ?? null;
      });
  if (!selectedSong) {
    throw new ApiError(
      400,
      "INVALID_SONG",
      "The selected song is not available for this game.",
    );
  }
  return finishAttempt(
    env,
    config,
    game,
    "guess",
    selectedSong.id,
    selectedSong.id === game.answerSongId,
  );
}

export async function recordSkip(
  env: Env,
  config: AppConfig,
  sessionToken: string,
) {
  return finishAttempt(
    env,
    config,
    await loadPlayingGame(env, sessionToken),
    "skip",
    null,
    false,
  );
}

export async function archiveBounds(env: Env) {
  const today = todayInIndia();
  const bounds = await getArchiveBounds(env.DB, previousIsoDate(today));
  return {
    earliestDate: bounds.earliest_date,
    latestDate: bounds.latest_date,
    today,
  };
}

export async function getMediaReference(
  env: Env,
  config: AppConfig,
  sessionToken: string,
  asset: MediaAsset,
) {
  const game = requireSession(await getSession(env.DB, await hashSessionToken(sessionToken)));
  return mediaReference(env, config, game, asset);
}

export async function getResultMediaReferences(
  env: Env,
  config: AppConfig,
  sessionToken: string,
) {
  const game = requireSession(await getSession(env.DB, await hashSessionToken(sessionToken)));
  return resultMediaBundle(env, config, game);
}
