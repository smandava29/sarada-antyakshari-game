import type { AttemptHistoryItem, GameStatus } from '../types/game';

interface AttemptTimelineProps {
  attemptsUsed: number;
  status: GameStatus;
  history: AttemptHistoryItem[];
  maxAttempts: number;
}

const clueLabels = [" 2 sec", "4 sec", "6 sec", "8 sec", "10 sec"];

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
        else if (status === 'playing' && index === attemptsUsed + 1) className += ' next-step';

        return <div className={className} key={index}>{clueLabels[index] ?? `${index + 1} sec`}</div>;
      })}
    </div>
  );
}
