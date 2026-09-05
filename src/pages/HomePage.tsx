import { GameView } from '../components/GameView';
import { todayIso } from '../lib/date';

export default function HomePage() {
  return (
    <main className="page-shell">
      <GameView questionDate={todayIso()} />
    </main>
  );
}
