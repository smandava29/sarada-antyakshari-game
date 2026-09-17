import { useMemo, useState } from 'react';
import { GameView } from '../components/GameView';
import { previousIsoDate, todayIso } from '../lib/date';
import { navigateTo } from '../lib/router';

export default function ArchivePage() {
  const latestArchiveDate = useMemo(
    () => previousIsoDate(todayIso()),
    [],
  );
  const [selectedDate, setSelectedDate] = useState(latestArchiveDate);

  return (
    <main className="page-shell">
      <div className="page-content">
        <div className="archive-toolbar">
          <div>
            <p className="eyebrow">Archives</p>
            <h3>Previous games</h3>
          </div>
          <div className="archive-controls">
            <label className="archive-date-field">
              <span className="archive-date-label">Choose date</span>
              <span className="archive-date-input-wrapper">
                <input
                  className="archive-date-picker"
                  type="date"
                  value={selectedDate}
                  max={latestArchiveDate}
                  onChange={(event) => {
                    if (event.target.value) {
                      setSelectedDate(event.target.value);
                    }
                  }}
                />
              </span>
            </label>
            <button
              className="secondary-button archive-today-button"
              type="button"
              onClick={() => navigateTo('/')}
            >
              Today
            </button>
          </div>
        </div>

        <GameView questionDate={selectedDate} />
      </div>
    </main>
  );
}
