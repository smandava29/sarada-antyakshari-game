import type { AppConfig } from "./config";
import {
  archiveBounds,
  getMediaReference,
  getResultMediaReferences,
  recordGuess,
  recordSkip,
  resumeGame,
  startGame,
} from "./services/game-service";
import type { Env, GameRequestBody } from "./types";
import {
  optionalQuestionDate,
  requireMediaAsset,
  requireSessionToken,
  requireSongSelection,
} from "./validation/request-validation";

export async function routeGameRequest(
  env: Env,
  config: AppConfig,
  body: GameRequestBody,
): Promise<unknown> {
  switch (body.action) {
    case "start":
      return startGame(env, config, optionalQuestionDate(body));
    case "resume":
      return resumeGame(env, config, requireSessionToken(body));
    case "guess":
      return recordGuess(
        env,
        config,
        requireSessionToken(body),
        requireSongSelection(body),
      );
    case "skip":
      return recordSkip(env, config, requireSessionToken(body));
    case "archive-bounds":
      return archiveBounds(env);
    case "media-url":
      return getMediaReference(
        env,
        config,
        requireSessionToken(body),
        requireMediaAsset(body),
      );
    case "result-media-urls":
      return getResultMediaReferences(env, config, requireSessionToken(body));
  }
}
