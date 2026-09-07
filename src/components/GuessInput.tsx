import Fuse from 'fuse.js';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!selectRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, []);

  const searchIndex = useMemo(
    () =>
      new Fuse(catalog, {
        keys: [
          { name: 'songTitle', weight: 0.8 },
          { name: 'movieTitle', weight: 0.2 },
        ],
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

    const normalizedQuery = value.toLowerCase();

    return searchIndex
      .search(value, { limit: 20 })
      .sort((a, b) => {
        const getMatchRank = (item: SongSuggestion) => {
          const songTitle = item.songTitle.toLowerCase();
          const movieTitle = item.movieTitle?.toLowerCase() ?? '';

          if (songTitle === normalizedQuery) return 0;
          if (movieTitle === normalizedQuery) return 1;
          if (songTitle.startsWith(normalizedQuery)) return 2;
          if (movieTitle.startsWith(normalizedQuery)) return 3;
          if (songTitle.includes(normalizedQuery)) return 4;
          if (movieTitle.includes(normalizedQuery)) return 5;
          return 6;
        };
        const aRank = getMatchRank(a.item);
        const bRank = getMatchRank(b.item);
        if (aRank !== bRank) { return aRank - bRank;}
        return (a.score ?? 0) - (b.score ?? 0);
      })
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
    setMenuOpen(false);
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

  const showSuggestions = menuOpen && !selected && query.trim().length >= 2;

  return (
    <div className="guess-area">
      <div className="guess-select" ref={selectRef}>
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
            onFocus={() => setMenuOpen(true)}
            onClick={() => setMenuOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
              setSearchError(null);
              setMenuOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setMenuOpen(false);
                return;
              }

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
          Skip this Chance (+2 sec)
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
