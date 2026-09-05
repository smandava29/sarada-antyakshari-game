export type GameStatus = 'playing' | 'won' | 'lost';
export type AttemptType = 'guess' | 'skip';
export type MediaAsset = 'question' | 'preview' | 'cover';
export interface SongSuggestion {
  id: string | null;
  songTitle: string;
  movieTitle: string | null;
}
export const MAX_ATTEMPTS = 5;

export interface SignedMedia {
  signedUrl: string;
}

export interface ResultMediaBundle {
  cover: SignedMedia;
  preview: SignedMedia;
}

export interface PublicAnswer {
  songTitle: string;
  movieTitle: string | null;
  composer: string | null;
  releaseYear: number | null;
  releasedAt: string | null;
}

export interface AttemptResult {
  attemptNumber: number;
  attemptType: AttemptType;
  submittedSongId: string | null;
  wasCorrect: boolean;
  createdAt: string;
}

export interface AttemptHistoryItem extends AttemptResult {
  songTitle: string | null;
  movieTitle: string | null;
}

export interface GameState {
  questionDate: string;
  status: GameStatus;
  attemptsUsed: number;
  maxAttempts: number;
  expiresAt: string;
  questionMedia: SignedMedia | null;
  answer: PublicAnswer | null;
  resultMedia: ResultMediaBundle |null;
  history: AttemptHistoryItem[];
}

export interface StartGameState extends GameState { sessionToken: string; }

export interface ArchiveBounds { earliestDate: string | null; latestDate: string | null; today: string; }

export interface GameApiEnvelope<T> { success: boolean; requestId: string; data: T; }

export interface GameApiErrorEnvelope {
  success: false;
  requestId: string;
  error: {
    code: string;
    message: string;
  };
}

export type AttemptResponse =
  | {
      status: "playing";
      attemptsUsed: number;
      attempt: AttemptHistoryItem;
    }
  | {
      status: "won" | "lost";
      attemptsUsed: number;
      attempt: AttemptHistoryItem;
      answer: PublicAnswer;
      resultMedia: ResultMediaBundle |null;
    };
