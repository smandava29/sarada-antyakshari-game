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
  const refreshAttemptedRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const onLoadErrorRef = useRef(onLoadError);
  const sessionTokenRef = useRef(sessionToken);
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

  useEffect(() => {
    sessionTokenRef.current = sessionToken;
  }, [sessionToken]);

  const cancelTiming = useCallback(() => {
    if (frameRef.current !== undefined) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }

  }, []);

  const getPlaybackLimit = useCallback(
    (audio: HTMLAudioElement) => {
      if (durationLimit === undefined) {
        return Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : null;
      }

      return Number.isFinite(audio.duration) && audio.duration > 0
        ? Math.min(audio.duration, durationLimit)
        : durationLimit;
    },
    [durationLimit],
  );

  const syncProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const playbackLimit = getPlaybackLimit(audio);
    if (playbackLimit !== null && playbackLimit > 0) {
      setProgress(Math.min(100, (audio.currentTime / playbackLimit) * 100));
    }
  }, [getPlaybackLimit]);

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

  const stopAtLimit = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return false;
    }

    const playbackLimit = getPlaybackLimit(audio);
    if (playbackLimit === null || audio.currentTime < playbackLimit) {
      return false;
    }

    cancelTiming();
    audio.pause();
    if (audio.currentTime !== playbackLimit) {
      audio.currentTime = playbackLimit;
    }
    setPlaying(false);
    setProgress(100);
    return true;
  }, [cancelTiming, getPlaybackLimit]);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    syncProgress();

    if (stopAtLimit() || audio.paused) {
      return;
    }

    frameRef.current = requestAnimationFrame(updateProgress);
  }, [stopAtLimit, syncProgress]);

  const setMediaSource = useCallback(
    async (forceRefresh: boolean) => {
      const sequence = ++requestSequenceRef.current;
      const activeSessionToken = sessionTokenRef.current;

      if (forceRefresh && !activeSessionToken && mediaUrl) {
        audioRef.current?.load();
        if (sequence === requestSequenceRef.current) {
          setSource(mediaUrl);
        }
        return;
      }

      const nextMedia = await getUsableMedia(
        activeSessionToken,
        asset,
        mediaUrl ? { signedUrl: mediaUrl } : null,
        forceRefresh,
      );

      if (sequence === requestSequenceRef.current) {
        setSource(nextMedia.signedUrl);
      }
    },
    [asset, mediaUrl],
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

  const play = async () => {
    if (disabled || loading || failed || !ready || playing) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    try {
      const playbackLimit = getPlaybackLimit(audio);

      if (playbackLimit !== null && audio.currentTime >= playbackLimit) {
        audio.currentTime = 0;
        setProgress(0);
      }

      await audio.play();
      updateProgress();
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
      void retry();
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
    syncProgress();
  };

  return (
    <div
      className={variant === "overlay" ? "audio-panel-overlay" : "audio-panel"}
    >
      <audio
        ref={audioRef}
        src={source ?? undefined}
        preload="metadata"
        onLoadedMetadata={markReady}
        onLoadedData={markReady}
        onCanPlay={markReady}
        onPlay={() => {
          setPlaying(true);
          updateProgress();
        }}
        onPause={() => {
          cancelTiming();
          setPlaying(false);
          syncProgress();
        }}
        onEnded={() => {
          stopAtLimit();
        }}
        onError={handleMediaError}
        onTimeUpdate={() => {
          syncProgress();
          stopAtLimit();
        }}
        onSeeking={syncProgress}
        onSeeked={() => {
          syncProgress();
          stopAtLimit();
        }}
        onDurationChange={syncProgress}
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
