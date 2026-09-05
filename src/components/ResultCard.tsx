import { LoaderCircle, RefreshCw, Share2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from "react";
import { useCountdown } from "../hooks/useCountdown";
import { formatCountdown } from '../lib/date';
import { gameApi } from "../lib/gameApi";
import { rememberMedia } from "../lib/secureMedia";
import type { AttemptHistoryItem, GameState, ResultMediaBundle } from '../types/game';
import { AudioPlayer } from './AudioPlayer';
import { SecureImage } from './SecureImage';

interface ResultCardProps {
  game: GameState;
  history: AttemptHistoryItem[];
  isToday: boolean;
  sessionToken: string;
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.append(textArea);
  textArea.select();

  const copied = document.execCommand("copy");
  textArea.remove();

  if (!copied) {
    throw new Error("Clipboard access is unavailable.");
  }
}

export function ResultCard({ game, history, isToday, sessionToken }: ResultCardProps) {
  const countdown = useCountdown();
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [resultMedia, setResultMedia] = useState<ResultMediaBundle | null>(game.resultMedia);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState(game.resultMedia === null);
  const statusTimerRef = useRef<number | undefined>(undefined);
  const answer = game.answer;

  useEffect(() => {
    setResultMedia(game.resultMedia);
    setMediaLoading(false);
    setMediaError(game.resultMedia === null);
    if (game.resultMedia) {
      rememberMedia(sessionToken, "cover", game.resultMedia.cover);
      rememberMedia(sessionToken, "preview", game.resultMedia.preview);
    }
  }, [game.resultMedia, sessionToken]);

  const retryResultMedia = useCallback(async () => {
    setMediaLoading(true);
    setMediaError(false);

    try {
      const bundle = await gameApi.resultMediaUrls(sessionToken);

      rememberMedia(sessionToken, "cover", bundle.cover);
      rememberMedia(sessionToken, "preview", bundle.preview);
      setResultMedia(bundle);
    } catch {
      setResultMedia(null);
      setMediaError(true);
    } finally {
      setMediaLoading(false);
    }
  }, [sessionToken]);

  const handleResultMediaError = useCallback(() => {
    setMediaLoading(false);
    setMediaError(true);
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current !== undefined) {
        window.clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  if (!answer) { return null; }

  const showShareStatus = (message: string) => {
    setShareStatus(message);

    if (statusTimerRef.current !== undefined) {
      window.clearTimeout(statusTimerRef.current);
    }

    statusTimerRef.current = window.setTimeout(() => {
      setShareStatus(null);
    }, 3_000);
  };

  const share = async () => {
    const websiteUrl = isToday
      ? window.location.origin
      : `${window.location.origin}/archive/${game.questionDate}`;

    const cells = history.map((attempt) => attempt.wasCorrect ? '🟩' : attempt.attemptType === 'skip' ? '⬜' : '🟥').join('');
    
    const gameLabel = isToday ? "today's game" : `the ${game.questionDate} archive game`;
    
    const text = [
      `Sarada Antyakshari ${game.questionDate}`,
      `${cells} ${game.attemptsUsed}/5`,
      `🎵 ${answer.songTitle}`,
      "",
      `Check out ${gameLabel} on Sarada Antyakshari!`,
    ].join("\n");

    const clipboardText = `${text}\n${websiteUrl}`;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${answer.songTitle} — Sarada Antyakshari`,
          text: text,
          url: websiteUrl,
        });
        showShareStatus("Game shared successfully.");
        return;
      }
      await copyText(clipboardText);
      showShareStatus("Share message copied to clipboard.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      try {
        await copyText(clipboardText);
        showShareStatus("Share message copied to clipboard.");
      } catch {
        showShareStatus("Unable to share or copy the message.");
      }
    }
  };

  return (
    <section className="result-card" aria-label="Game result">
      <div className="result-cover-column">
        <div className="cover-wrapper">
          {resultMedia ? (
            <SecureImage
              sessionToken={sessionToken}
              media={resultMedia.cover}
              className="cover-image"
              alt={`${answer.songTitle} cover`}
              refreshOnError={false}
              onLoadError={handleResultMediaError}
            />
          ) : (
            <div
              className="cover-placeholder"
              aria-label={`Loading ${answer.songTitle} cover`}
            >
              ♫
            </div>
          )}

          {resultMedia && (
            <AudioPlayer 
              sessionToken={sessionToken} 
              asset="preview" 
              media={resultMedia.preview} 
              variant="overlay"
              refreshOnError= {false}
              onLoadError={handleResultMediaError} 
            />
          )}
        </div>

        {mediaLoading && (
          <div 
            className="media-state-overlay result-media-state" role="status" aria-label="Loading media"
          >
            <span className="" aria-hidden="true">
              <LoaderCircle className="media-spineer" />
            </span>
          </div>
        )}

        {mediaError && (
            <div className="media-state-overlay result-media-state">
              <button
                className="media-overlay-control"
                type="button"
                onClick={() => void retryResultMedia()}
                aria-label="Retry loading result media"
              >
                <RefreshCw aria-hidden="true" />
              </button>
            </div>
          )}
      </div>

      <div className="result-details-column">
        <div className="result-body">
          <p className={`result-label ${game.status}`}>{game.status === 'won' ? 'You got it!' : 'Better luck next time'}</p>
          <h2>{answer.songTitle}</h2>
          <p className="movie-line">
            {answer.movieTitle ?? 'Unknown movie'} 
            {answer.releaseYear ? ` (${answer.releaseYear})` : ""}
          </p>
          <div className="result-meta">
            {answer.composer && <div><span>Composer</span>{answer.composer}</div>}
          </div>
        </div>

        <div className="result-footer-row">
          <div>
            <button
              className="share-icon-button"
              type="button"
              onClick={() => void share()}
              aria-label={`Share ${answer.songTitle}`}
            >
              <Share2 size={18} />
            </button>

            {shareStatus && (
              <p className="share-status" role="status" aria-live="polite">
                {shareStatus}
              </p>
            )}
          </div>

          {isToday && (
            <div className="next-game">
              <span>Next song in (IST)</span>
              <strong>{formatCountdown(countdown)}</strong>
              </div>
            )}
        </div>
      </div>
    </section>
  );
}
