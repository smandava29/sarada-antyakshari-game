import { LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getUsableMedia } from "../lib/secureMedia";
import type { SignedMedia } from "../types/game";

interface SecureImageProps {
  sessionToken: string;
  media: SignedMedia;
  alt: string;
  className?: string;
  refreshOnError?: boolean;
  onLoadError?: () => void;
}

type ImageStatus = "loading" | "ready" | "failed";

export function SecureImage({
  sessionToken,
  media,
  alt,
  className,
  refreshOnError = true,
  onLoadError,
}: SecureImageProps) {
  const requestSequenceRef = useRef(0);
  const refreshAttemptedRef = useRef(false);
  const onLoadErrorRef = useRef(onLoadError);
  const mediaUrl = media.signedUrl.trim();
  const [source, setSource] = useState<string | null>(null);
  const [status, setStatus] = useState<ImageStatus>("loading");

  useEffect(() => {
    onLoadErrorRef.current = onLoadError;
  }, [onLoadError]);

  const loadSource = useCallback(
    async (forceRefresh: boolean) => {
      const sequence = ++requestSequenceRef.current;
      const nextMedia = await getUsableMedia(
        sessionToken,
        "cover",
        { signedUrl: mediaUrl },
        forceRefresh,
      );

      if (sequence === requestSequenceRef.current) {
        setSource(nextMedia.signedUrl);
      }
    },
    [mediaUrl, sessionToken],
  );

  useEffect(() => {
    requestSequenceRef.current += 1;
    refreshAttemptedRef.current = false;
    setSource(null);
    setStatus("loading");

    void loadSource(false).catch(() => {
      setStatus("failed");
      onLoadErrorRef.current?.();
    });

    return () => {
      requestSequenceRef.current += 1;
    };
  }, [loadSource]);

  const retry = useCallback(async () => {
    refreshAttemptedRef.current = true;
    setStatus("loading");

    try {
      await loadSource(true);
    } catch {
      setStatus("failed");
    }
  }, [loadSource]);

  const handleError = () => {
    if (!refreshOnError) {
      setStatus("failed");
      onLoadErrorRef.current?.();
      return;
    }

    if (refreshAttemptedRef.current) {
      setStatus("failed");
      onLoadErrorRef.current?.();
      return;
    }

    void retry();
  };

  return (
    <div className="secure-image-frame" aria-busy={status === "loading"}>
      {status !== "ready" && (
        <div className="cover-placeholder" aria-hidden="true">
          ♫
        </div>
      )}

      {source && (
        <img
          className={className}
          src={source}
          alt={alt}
          hidden={status !== "ready"}
          onLoad={() => setStatus("ready")}
          onError={handleError}
        />
      )}

      {status === "loading" && (
        <div
          className="media-state-overlay"
          role="status"
          aria-label={`Loading ${alt}`}
        >
          <span className="media-overlay-control" aria-hidden="true">
            <LoaderCircle className="media-spinner" />
          </span>
        </div>
      )}

      {status === "failed" && refreshOnError && (
        <div className="media-state-overlay">
          <button
            className="media-overlay-control"
            type="button"
            onClick={() => void retry()}
            aria-label={`Retry loading ${alt}`}
          >
            <RefreshCw aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
