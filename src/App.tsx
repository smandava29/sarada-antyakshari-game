import { lazy, Suspense, useState } from 'react';
import { Header } from './components/Header';
import { Modal } from './components/Modal';
import { AdsLayout } from "./components/AdsLayout";
import { FooterActions } from './components/FooterActions';
import { PrivacyControls } from './components/PrivacyControls';
import { usePathname } from './lib/router';

const HomePage = lazy(() => import('./pages/HomePage'));
const ArchivePage = lazy(() => import('./pages/ArchivePage'));

function RouteFallback() {
  return (
    <main className="page-shell">
      <section className="state-card" aria-live="polite">
        <p>Loading…</p>
      </section>
    </main>
  );
}

function NotFoundRoute() {
  return (
    <main className="page-shell">
      <section className="state-card">
        <h1>Page not found</h1>
        <p>The page you requested does not exist.</p>
        <a className="primary-button inline-button" href="/">Play today’s game</a>
      </section>
    </main>
  );
}

function AppRoute({ pathname }: { pathname: string }) {
  if (pathname === '/') {
    return <HomePage />;
  }

  if (pathname === '/archive' || pathname === '/archive/') {
    return <ArchivePage />;
  }

  return <NotFoundRoute />;
}

export default function App() {
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  return (
    <AdsLayout>
      <div className="app-shell">
        <Header
          onHelp={() => setHelpOpen(true)}
          onStats={() => setStatsOpen(true)}
        />

        <Suspense fallback={<RouteFallback />}>
          <AppRoute pathname={pathname} />
        </Suspense>

        <footer className="site-footer">
          <FooterActions>
            A Telugu song guessing game • New song every day
          </FooterActions>
          <PrivacyControls />
        </footer>

        <Modal title="How to play" open={helpOpen} onClose={() => setHelpOpen(false)}>
          <div className="instructions-grid">
            <div><strong>5</strong><span>Chances</span></div>
            <div><strong>10s</strong><span>Maximum clue</span></div>
            <div><strong>Daily</strong><span>New game</span></div>
          </div>
          <ol className="instruction-list">
            <li>Play the song clue.</li>
            <li>Search and choose a song, or skip the chance (+2sec).</li>
            <li>Skip or incorrect guess unlocks a longer portion of the song.</li>
            <li>The song reveals after a correct guess or after all attempts.</li>
          </ol>
        </Modal>

        <Modal title="Today's status" open={statsOpen} onClose={() => setStatsOpen(false)}>
          <ol className="stats-list">
            <li>Stats are not tracked yet.</li>
            <li>This is a placeholder for future functionality.</li>
            <li>If you feel stats are important, get a life bro.</li>
          </ol>
        </Modal>
      </div>
    </AdsLayout>
  );
}
