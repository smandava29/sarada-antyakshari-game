import type { AttemptHistoryItem } from '../types/game';

export function AttemptHistory({ history }: { history: AttemptHistoryItem[] }) {
  if (history.length === 0) return null;
  return (
    <div className="attempt-history" aria-label="Attempt history">
      {history.map((attempt) => (
        <div className={`attempt-history-item ${attempt.wasCorrect ? 'correct' : attempt.attemptType === 'skip' ? 'skipped' : 'wrong'}`} key={attempt.attemptNumber}>
          <strong>#{attempt.attemptNumber}</strong>
          <div className="history-copy">
            <span>{attempt.attemptType === 'skip' ? 'Skipped' : attempt.songTitle}</span>
          </div>
          <span aria-label={attempt.wasCorrect ? 'Correct' : 'Incorrect'}>{attempt.wasCorrect ? '✓' : attempt.attemptType === 'skip' ? '—' : '×'}</span>
        </div>
      ))}
    </div>
  );
}
