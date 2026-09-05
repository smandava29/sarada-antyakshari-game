import type { GameRecord, MediaAsset } from "../types";
import { ApiError } from "../utils/errors";

const SONG_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;

export function resolveAuthorizedMediaPath(game: GameRecord, asset: MediaAsset): string {
  switch (asset) {
    case "question": {
      if (game.status !== "playing") {
        throw new ApiError(403, "MEDIA_NOT_AVAILABLE", "Question media is unavailable after the game ends.");
      }
      return `question-clips/${game.questionDate}.m4a`;
    }
    case "cover":
    case "preview": {
      if (game.status === "playing") {
        throw new ApiError(403, "MEDIA_NOT_AVAILABLE", "Result media is available after the game ends.");
      }
      if (!SONG_ID_PATTERN.test(game.answerSongId)) {
        throw new ApiError(500, "INVALID_MEDIA_PATH", "The result media path is invalid.");
      }
      return asset === "cover"
        ? `covers/${game.answerSongId}.jpg`
        : `result-previews/${game.answerSongId}.m4a`;
    }
  }
}
