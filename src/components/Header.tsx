import { CalendarDays, CircleHelp, BarChart3 } from 'lucide-react';
import { usePathname } from '../lib/router';
import { AppLink } from './AppLink';

interface HeaderProps {
  onHelp: () => void;
  onStats: () => void;
}

export function Header({ onHelp, onStats }: HeaderProps) {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="header-inner">
        <AppLink className="brand" href="/" aria-label="Saradaga Antyakshari home">
          {/* <span className="brand-mark" aria-hidden="true">♫</span> */}
          <img className="brand-logo" src="/logo.png" alt="" aria-hidden="true" />
          <span className="brand-name">Saradaga Antyakshari</span>
        </AppLink>
        <nav className="header-actions" aria-label="Game controls">
          <AppLink className={`icon-button ${pathname.startsWith('/archive') ? 'active' : ''}`} href="/archive" aria-label="Archive">
            <CalendarDays size={19} />
          </AppLink>
          <button className="icon-button" type="button" onClick={onStats} aria-label="Today's status">
            <BarChart3 size={19} />
          </button>
          <button className="icon-button" type="button" onClick={onHelp} aria-label="How to play">
            <CircleHelp size={19} />
          </button>
        </nav>
      </div>
    </header>
  );
}
