import { LoaderCircle, Pause, Play, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getUsableMedia } from "../lib/secureMedia";
import type { MediaAsset, SignedMedia } from "../types/game";

interface AudioPlayerProps {
  sessionToken: string;
  asset: Extract<MediaAsset, "question" | "preview">;
  media: SignedMedia | null;
  durationLimit?: number;
  disabled?: boolean;
  label?: string;
  variant?: "default" | "overlay";
  refreshOnError?: boolean;
  showRetryOnError?: boolean;
  onLoadError?: () => void;
}

export function AudioPlayer({
  sessionToken,
  asset,
  media,
  durationLimit,
  disabled = false,
  label = "Play",
  variant = "default",
  refreshOnError = true,
  showRetryOnError = true,
  onLoadError,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const frameRef = useRef<number | undefined>(undefined);
  const stopTimerRef = useRef<number | undefined>(undefined);
  const refreshAttemptedRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const onLoadErrorRef = useRef(onLoadError);
  const mediaUrl = media?.signedUrl.trim() || null;

  const [source, setSource] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(Boolean(media));
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    onLoadErrorRef.current = onLoadError;
  }, [onLoadError]);

  const cancelTiming = useCallback(() => {
    if (frameRef.current !== undefined) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }

    if (stopTimerRef.current !== undefined) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = undefined;
    }
  }, []);

  const resetPlayback = useCallback(() => {
    cancelTiming();

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // Metadata may not be available while the source is changing.
      }
    }

    setPlaying(false);
    setProgress(0);
  }, [cancelTiming]);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) {
      return;
    }

    const playbackLimit =
      durationLimit === undefined
        ? audio.duration
        : Math.min(audio.duration || durationLimit, durationLimit);

    if (Number.isFinite(playbackLimit) && playbackLimit > 0) {
      setProgress(Math.min(100, (audio.currentTime / playbackLimit) * 100));
    }

    frameRef.current = requestAnimationFrame(updateProgress);
  }, [durationLimit]);

  const setMediaSource = useCallback(
    async (forceRefresh: boolean) => {
      const sequence = ++requestSequenceRef.current;
      const nextMedia = await getUsableMedia(
        sessionToken,
        asset,
        mediaUrl ? { signedUrl: mediaUrl } : null,
        forceRefresh,
      );

      if (sequence === requestSequenceRef.current) {
        setSource(nextMedia.signedUrl);
      }
    },
    [asset, mediaUrl, sessionToken],
  );

  useEffect(() => {
    requestSequenceRef.current += 1;
    refreshAttemptedRef.current = false;
    resetPlayback();
    setSource(null);
    setReady(false);
    setFailed(false);

    if (!mediaUrl) {
      setLoading(false);
      setFailed(true);
      return;
    }

    setLoading(true);
    void setMediaSource(false).catch(() => {
      setLoading(false);
      setFailed(true);
      onLoadErrorRef.current?.();
    });

    return () => {
      requestSequenceRef.current += 1;
      resetPlayback();
    };
  }, [mediaUrl, resetPlayback, setMediaSource]);

  useEffect(() => {
    resetPlayback();
  }, [durationLimit, resetPlayback]);

  const retry = useCallback(async () => {
    refreshAttemptedRef.current = true;
    resetPlayback();
    setFailed(false);
    setReady(false);
    setLoading(true);

    try {
      await setMediaSource(true);
    } catch {
      setLoading(false);
      setFailed(true);
    }
  }, [resetPlayback, setMediaSource]);

  const handleMediaError = useCallback(() => {
    if (!refreshOnError) {
      setLoading(false);
      setReady(false);
      setPlaying(false);
      setFailed(true);
      onLoadErrorRef.current?.();
      return;
    }

    if (refreshAttemptedRef.current) {
      setLoading(false);
      setReady(false);
      setPlaying(false);
      setFailed(true);
      onLoadErrorRef.current?.();
      return;
    }

    void retry();
  }, [refreshOnError, retry]);

  const stopAtLimit = useCallback(() => {
    resetPlayback();
  }, [resetPlayback]);

  const play = async () => {
    if (disabled || loading || failed || !ready || playing) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    try {
      const playbackLimit =
        durationLimit === undefined
          ? audio.duration
          : Math.min(audio.duration || durationLimit, durationLimit);

      if (
        Number.isFinite(playbackLimit) &&
        audio.currentTime >= playbackLimit
      ) {
        audio.currentTime = 0;
        setProgress(0);
      }

      await audio.play();
      setPlaying(true);

      if (Number.isFinite(playbackLimit)) {
        const remaining = Math.max(0, playbackLimit - audio.currentTime);
        stopTimerRef.current = window.setTimeout(
          stopAtLimit,
          remaining * 1_000,
        );
      }

      frameRef.current = requestAnimationFrame(updateProgress);
    } catch {
      setPlaying(false);
      setFailed(true);
      onLoadErrorRef.current?.();
    }
  };

  const pause = () => {
    cancelTiming();
    audioRef.current?.pause();
    setPlaying(false);
  };

  const activate = () => {
    if (failed) {
      if (refreshOnError) {
        void retry();
      } else {
        onLoadErrorRef.current?.();
      }
    } else if (playing) {
      pause();
    } else {
      void play();
    }
  };

  const buttonLabel = failed
    ? "Retry audio"
    : playing
      ? "Pause audio"
      : label || "Play audio";

  const markReady = () => {
    setLoading(false);
    setReady(true);
    setFailed(false);
  };

  return (
    <div
      className={variant === "overlay" ? "audio-panel-overlay" : "audio-panel"}
    >
      <audio
        ref={audioRef}
        src={source ?? undefined}
        preload="auto"
        onLoadedMetadata={markReady}
        onLoadedData={markReady}
        onCanPlay={markReady}
        onEnded={stopAtLimit}
        onError={handleMediaError}
        onTimeUpdate={() => {
          const audio = audioRef.current;
          if (
            audio &&
            durationLimit !== undefined &&
            audio.currentTime >= durationLimit
          ) {
            stopAtLimit();
          }
        }}
      />

      {(!failed || showRetryOnError) && (
        <button
          type="button"
          className={
            variant === "overlay"
              ? "play-button play-button-overlay"
              : "play-button"
          }
          disabled={disabled || loading || (!ready && !failed)}
          onClick={activate}
          aria-label={loading ? "Loading audio" : buttonLabel}
          aria-busy={loading}
        >
          {loading ? (
            <LoaderCircle className="media-spinner" aria-hidden="true" />
          ) : failed ? (
            <RefreshCw aria-hidden="true" />
          ) : playing ? (
            <Pause size={17} fill="currentColor" aria-hidden="true" />
          ) : (
            <Play size={17} fill="currentColor" aria-hidden="true" />
          )}

          {variant === "default" &&
            (loading ? "Loading…" : failed ? "Retry" : playing ? "Pause" : label)}
        </button>
      )}

      {variant === "default" && (
        <div className="audio-progress" aria-hidden="true">
          <div
            className="audio-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
