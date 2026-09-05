import Fuse from 'fuse.js';
import { useEffect, useMemo, useState } from 'react';
import { getSongCatalog } from '../lib/songCatalog';
import type { SongSuggestion } from '../types/game';

interface GuessInputProps {
  disabled: boolean;
  onGuess: (song: SongSuggestion) => Promise<void>;
  onSkip: () => Promise<void>;
}

export function GuessInput({ disabled, onGuess, onSkip }: GuessInputProps) {
  const [catalog, setCatalog] = useState<SongSuggestion[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SongSuggestion | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setLoadingCatalog(true);
    setSearchError(null);

    void getSongCatalog()
      .then((songs) => {
        if (active) {
          setCatalog(songs);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setCatalog([]);
          setSearchError(
            caught instanceof Error
            ? caught.message : 'The song catalog is unavailable',
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoadingCatalog(false);
        }
      })
    return () => {
      active = false;
    };
  }, []);

  const searchIndex = useMemo(
    () =>
      new Fuse(catalog, {
        keys: ['songTitle'],
        threshold: 0.3,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [catalog],
  );

  const suggestions = useMemo(() => {
    const value = query.trim();

    if (
      selected ||
      value.length < 2 ||
      loadingCatalog
    ) {
      return [];
    }

    return searchIndex
      .search(value, { limit: 20 })
      .map((result) => result.item);
  }, [
    loadingCatalog,
    query,
    searchIndex,
    selected,
  ]);

  const choose = (song: SongSuggestion) => {
    setSelected(song);
    setQuery(song.songTitle);
    setSearchError(null);
  };

  const clear = () => {
    setSelected(null);
    setQuery('');
    setSearchError(null);
  };

  const submit = async () => {
    if (!selected || disabled) return;
    await onGuess(selected);
    clear();
  };

  const showSuggestions = !selected && query.trim().length >= 2;

  return (
    <div className="guess-area">
      <div className="guess-select">
        <div className="guess-input-row">
          <input
            aria-label="Search for a song"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            autoComplete="off"
            disabled={disabled || loadingCatalog}
            placeholder={
              loadingCatalog
                ? 'Loading songs...'
                : 'Type a song title...'
            }
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
              setSearchError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && selected) {
                void submit();
              }
            }}
          />

          {query && (
            <button
              className="clear-button"
              type="button"
              onClick={clear}
              aria-label="Clear selection"
            >
              ×
            </button>
          )}
        </div>

        {showSuggestions && (
          <div
            className="suggestion-menu"
            role="listbox"
            aria-label="Matching songs"
          >
            {loadingCatalog && (
              <div className="suggestion-empty">
                Loading songs…
              </div>
            )}

            {!loadingCatalog &&
              suggestions.map((song) => (
                <button
                  className="suggestion-option"
                  type="button"
                  role="option"
                  aria-selected={false}
                  key={song.id ?? `${song.songTitle}:${song.movieTitle ?? ''}`}
                  onClick={() => choose(song)}
                >
                  <strong>{song.songTitle}</strong>
                  {song.movieTitle && <small>{song.movieTitle}</small>}
                </button>
              ))}

            {!loadingCatalog && searchError && (
              <div className="suggestion-empty error-text">
                {searchError}
              </div>
            )}

            {!loadingCatalog &&
              !searchError &&
              suggestions.length === 0 && (
                <div className="suggestion-empty">
                  No matching songs
                </div>
              )}
          </div>
        )}
      </div>

      <div className="guess-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={disabled}
          onClick={() => void onSkip()}
        >
          Skip
        </button>

        <button
          className="primary-button"
          type="button"
          disabled={disabled || !selected}
          onClick={() => void submit()}
        >
          Submit guess
        </button>
      </div>
    </div>
  );
}
