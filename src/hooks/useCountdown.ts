import { useEffect, useState } from 'react';
import { secondsUntilTomorrow } from '../lib/date';

export function useCountdown(): number {
  const [seconds, setSeconds] = useState(secondsUntilTomorrow);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(secondsUntilTomorrow()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return seconds;
}
