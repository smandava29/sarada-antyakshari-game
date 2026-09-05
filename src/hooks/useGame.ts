import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gameApi, GameApiError } from '../lib/gameApi';
import { rememberMedia } from '../lib/secureMedia';
import {
  cleanupExpiredSessions,
  clearSessionToken,
  getSessionToken,
  loadAttemptHistory,
  saveAttemptHistory,
  refreshSession,
  saveSessionToken,
} from '../lib/sessionStorage';
import type {
  AttemptHistoryItem,
  AttemptResponse,
  GameState,
  SongSuggestion,
} from '../types/game';
import { MAX_ATTEMPTS as DEFAULT_MAX_ATTEMPTS } from '../types/game';

interface UseGameResult {
  game: GameState | null;
  sessionToken: string | null;
  history: AttemptHistoryItem[];
  loading: boolean;
  submitting: boolean;
  error: string | null;
  startOrResume: () => Promise<void>;
  submitGuess: (song: SongSuggestion) => Promise<void>;
  skip: () => Promise<void>;
  clearError: () => void;
}

function gameStateFromStart(
  started: GameState & { sessionToken: string },
): GameState {
  return {
    questionDate: started.questionDate,
    status: started.status,
    attemptsUsed: started.attemptsUsed,
    maxAttempts: started.maxAttempts,
    expiresAt: started.expiresAt,
    questionMedia: started.questionMedia,
    answer: started.answer,
    resultMedia: started.resultMedia,
    history: started.history,
  };
}

function initialGameState(questionDate: string): GameState {
  return {
    questionDate,
    status: "playing",
    attemptsUsed: 0,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    expiresAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
    questionMedia: {
      signedUrl: `/api/question-clip?date=${encodeURIComponent(questionDate)}`,
    },
    answer: null,
    resultMedia: null,
    history: [],
  };
}

function mergeAttemptResponse(
  current: GameState | null,
  response: AttemptResponse,
): GameState | null {
  if (!current) return null;
  return {
    ...current,
    status: response.status,
    attemptsUsed: response.attemptsUsed,
    answer: response.status === "playing" ? null : response.answer,
    resultMedia: response.status === "playing" ? null : response.resultMedia,
    history: current.history.some(
      (attempt) => attempt.attemptNumber === response.attempt.attemptNumber,
    )
      ? current.history
      : [...current.history, response.attempt],
  };
}

export function useGame(questionDate: string): UseGameResult {
  const [game, setGame] = useState<GameState | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [history, setHistory] = useState<AttemptHistoryItem[]>(() =>
    loadAttemptHistory<AttemptHistoryItem>(questionDate),
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestSequence = useRef(0);
  const submittingRef = useRef(false);

  useEffect(() => {
    cleanupExpiredSessions();
  }, []);

  useEffect(() => {
    setHistory(loadAttemptHistory<AttemptHistoryItem>(questionDate));
  }, [questionDate]);

  const startOrResume = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError(null);

    try {
      const existingToken = getSessionToken(questionDate);
      if (existingToken) {
        try {
          const resumed = await gameApi.resume(existingToken);
          if (sequence !== requestSequence.current) return;
          refreshSession(questionDate, resumed.expiresAt);
          setSessionToken(existingToken);
          setGame(resumed);
          setHistory(resumed.history);
          saveAttemptHistory(resumed.questionDate, resumed.history);
          rememberMedia(existingToken, "question", resumed.questionMedia);
          if (resumed.resultMedia) {
            rememberMedia(existingToken, "cover", resumed.resultMedia.cover);
            rememberMedia(existingToken, "preview", resumed.resultMedia.preview);
          }
          return;
        } catch (resumeError) {
          if (
            !(resumeError instanceof GameApiError)
            || !['SESSION_NOT_FOUND', 'SESSION_EXPIRED'].includes(resumeError.code)
          ) {
            throw resumeError;
          }
          clearSessionToken(questionDate);
          setSessionToken(null);
        }
      }

      const initialGame = initialGameState(questionDate);
      if (sequence !== requestSequence.current) return;

      setSessionToken(null);
      setGame(initialGame);
      setHistory([]);
      saveAttemptHistory(questionDate, []);
    } catch (caught) {
      if (sequence !== requestSequence.current) return;
      setError(caught instanceof Error ? caught.message : 'Unable to load the game.');
      setGame(null);
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [questionDate]);

  useEffect(() => {
    void startOrResume();
    return () => {
      requestSequence.current += 1;
    };
  }, [startOrResume]);

  const ensureSession = useCallback(async (): Promise<string> => {
    const existingToken = getSessionToken(questionDate);

    if (existingToken) {
      setSessionToken(existingToken);
      return existingToken;
    }

    const started = await gameApi.start(questionDate);
    saveSessionToken(started.questionDate, started.sessionToken, started.expiresAt);
    setSessionToken(started.sessionToken);

    setGame((current) => ({
      ...gameStateFromStart(started),
      questionMedia: current?.questionMedia ?? started.questionMedia,
    }));

    rememberMedia(started.sessionToken, "question", started.questionMedia);
    return started.sessionToken;
  }, [questionDate]);

  const applyAttempt = useCallback((response: AttemptResponse, activeSessionToken: string | null) => {
    const item = response.attempt;

    setHistory((previous) => {
      if (previous.some((attempt) => attempt.attemptNumber === item.attemptNumber)) {
        return previous;
      }
      const next = [...previous, item];
      saveAttemptHistory(questionDate, next);
      return next;
    });
    setGame((current) => mergeAttemptResponse(current, response));

    if (activeSessionToken && response.status !== "playing" && response.resultMedia) {
      rememberMedia(activeSessionToken, "cover", response.resultMedia.cover);
      rememberMedia(activeSessionToken, "preview", response.resultMedia.preview);
    }

  }, [questionDate]);

  const submitGuess = useCallback(
    async (song: SongSuggestion) => {
      if (
        !game ||
        game.status !== 'playing'
      ) {
        return;
      }

      submittingRef.current = true;
      setSubmitting(true);
      setError(null);

      try {
        const activeSessionToken = await ensureSession();
        const response = await gameApi.guess(
          activeSessionToken,
          song,
        );

        applyAttempt(response, activeSessionToken);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to submit the guess.',
        );
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [applyAttempt, ensureSession, game],
  );

  const skip = useCallback(async () => {
    if (
      submittingRef.current
      || !game
      || game.status !== 'playing'
    ) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const activeSessionToken = await ensureSession();
      const response = await gameApi.skip(activeSessionToken);
      applyAttempt(response, activeSessionToken);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to skip this chance.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [applyAttempt, ensureSession, game]);

  return useMemo(() => ({
    game,
    sessionToken,
    history,
    loading,
    submitting,
    error,
    startOrResume,
    submitGuess,
    skip,
    clearError: () => setError(null),
  }), [
    error,
    game,
    history,
    loading,
    sessionToken,
    skip,
    startOrResume,
    submitGuess,
    submitting,
  ]);
}
