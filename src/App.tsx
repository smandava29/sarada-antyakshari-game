import { lazy, Suspense, useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Modal } from './components/Modal';
import { AdsLayout } from "./components/AdsLayout";
import { FooterActions } from './components/FooterActions';
import { PrivacyControls } from './components/PrivacyControls';
import { navigateTo, usePathname } from './lib/router';

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

function UnknownRoute() {
  useEffect(() => {
    navigateTo('/', true);
  }, []);
  return <RouteFallback />;
}

function AppRoute({ pathname }: { pathname: string }) {
  if (pathname === '/') {
    return <HomePage />;
  }

  const archiveMatch = pathname.match(/^\/archive(?:\/([^/]+))?\/?$/);
  if (archiveMatch) {
    return <ArchivePage requestedDate={archiveMatch[1]} />;
  }

  return <UnknownRoute />;
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
          <ol className="instruction-list">
            <li>Play the song clue.</li>
            <li>Search and choose a song, or skip the chance.</li>
            <li>Skip or incorrect guess unlocks a longer portion of the song.</li>
            <li>The song reveals after a correct guess or after all attempts.</li>
          </ol>
        </Modal>

        <Modal title="Today's status" open={statsOpen} onClose={() => setStatsOpen(false)}>
          <div className="status-grid">
            <div><strong>5</strong><span>Chances</span></div>
            <div><strong>10s</strong><span>Maximum clue</span></div>
            <div><strong>Daily</strong><span>New game</span></div>
          </div>
          <p className="muted-text">
            Game sessions and attempt history stay in this browser tab and expire with the server session.
          </p>
        </Modal>
      </div>
    </AdsLayout>
  );
}
