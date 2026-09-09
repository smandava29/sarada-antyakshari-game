import { config } from '../lib/config';
import { formatGameDate, todayIso } from '../lib/date';
import { useGame } from '../hooks/useGame';
import { AttemptHistory } from './AttemptHistory';
import { AttemptTimeline } from './AttemptTimeline';
import { AudioPlayer } from './AudioPlayer';
import { GuessInput } from './GuessInput';
import { ResultCard } from './ResultCard';

export function GameView({
  questionDate,
}: {
  questionDate: string;
}) {
  const {
    game,
    sessionToken,
    history,
    loading,
    submitting,
    error,
    startOrResume,
    submitGuess,
    skip,
  } = useGame(questionDate);

  if (loading) {
    return (
      <section className="state-card">
        <p>Loading the song…</p>
      </section>
    );
  }

  if (error && !game) {
    return (
      <section className="state-card">
        <p className="error-text">
          {error ===
          'The requested game is not available.'
            ? 'Game not found for this date.'
            : error}
        </p>

        <button
          className="primary-button inline-button"
          type="button"
          onClick={() => void startOrResume()}
        >
          Try again
        </button>
      </section>
    );
  }

  if (!game) {
    return null;
  }

  const mediaSessionToken =
    sessionToken ?? '';

  const duration =
    config.attemptDurations[
      Math.min(
        game.attemptsUsed,
        config.attemptDurations.length - 1,
      )
    ];

  const finished =
    game.status !== 'playing';

  const showResult =
    finished && game.answer !== null;

  const gameNotFound = error === 'The requested game is not available.';

  return (
    <div className="page-content">
      <div className="page-intro">
        <p className="eyebrow">
          {questionDate === todayIso()
            ? "Today's game"
            : 'Archive game'}
        </p>

        <p>{formatGameDate(questionDate)}</p>
      </div>

      {gameNotFound ? (
        <section className="state-card">
          <p className="error-text">
            Game not found for this date.
          </p>
        </section>
      ) : (
        <section className="game-card">
          <AttemptTimeline
            attemptsUsed={game.attemptsUsed}
            status={game.status}
            history={history}
            maxAttempts={game.maxAttempts}
          />

          {!finished && (
            <>
              {questionDate === todayIso() && game.attemptsUsed === 0 && (
                <p className="game-hint">
                  Listen to the song clue, Guess the Song, or Skip the chance and listen to two more seconds of the song.
                </p>
              )}

              <AudioPlayer
                sessionToken={mediaSessionToken}
                asset="question"
                media={game.questionMedia}
                durationLimit={duration}
                disabled={submitting}
                refreshOnError={Boolean(sessionToken)}
                showRetryOnError
              />

              <GuessInput
                disabled={submitting}
                isLastChance={game.attemptsUsed === game.maxAttempts - 1}
                onGuess={submitGuess}
                onSkip={skip}
              />

              {error && (
                <p className="game-message error">
                  {error}
                </p>
              )}

              <p className="tries-remaining" aria-live="polite">
                You have {game.maxAttempts - game.attemptsUsed} {game.maxAttempts - game.attemptsUsed === 1 ? 'try' : 'tries'} remaining.
              </p>
            </>
          )}

          {showResult && sessionToken && (
            <ResultCard
              game={game}
              isToday={
                questionDate === todayIso()
              }
              sessionToken={sessionToken}
            />
          )}

          <AttemptHistory history={history} />
        </section>
      )}
    </div>
  );
}
