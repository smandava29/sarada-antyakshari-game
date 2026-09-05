import type { AttemptHistoryItem, GameStatus } from '../types/game';

interface AttemptTimelineProps {
  attemptsUsed: number;
  status: GameStatus;
  history: AttemptHistoryItem[];
  maxAttempts: number;
}

export function AttemptTimeline({ attemptsUsed, status, history, maxAttempts }: AttemptTimelineProps) {
  return (
    <div className="attempt-timeline" aria-label={`${attemptsUsed} of ${maxAttempts} chances used`}>
      {Array.from({ length: maxAttempts }, (_, index) => {
        const attempt = history[index];
        let className = 'attempt-step';
        if (attempt?.wasCorrect) className += ' correct';
        else if (attempt?.attemptType === 'skip') className += ' skipped';
        else if (attempt) className += ' wrong';
        else if (status === 'playing' && index === attemptsUsed) className += ' current';
        return <div className={className} key={index}>{index + 1}</div>;
      })}
    </div>
  );
}
