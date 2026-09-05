import type { SongSuggestion } from '../types/game';

interface SongCatalogDocument { songs: unknown[]; }
let catalogPromise: Promise<SongSuggestion[]> | null = null;

function parseCatalog(value: unknown): SongSuggestion[] {
  const candidates = Array.isArray(value)
    ? value
    : typeof value === 'object' && value !== null && 'songs' in value
      ? (value as SongCatalogDocument).songs
      : null;
  if (!Array.isArray(candidates)) throw new Error('Invalid suggestions catalog format.');

  const seen = new Set<string>();
  const songs: SongSuggestion[] = [];
  for (const candidate of candidates) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const record = candidate as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() || null : null;
    const rawSongTitle = record.songTitle ?? record.song_title;
    const rawMovieTitle = record.movieTitle ?? record.movie_title;
    const songTitle = typeof rawSongTitle === 'string' ? rawSongTitle.trim() : '';
    const movieTitle = typeof rawMovieTitle === 'string' ? rawMovieTitle.trim() || null : null;
    const identity = id ?? `${songTitle}\u0000${movieTitle ?? ''}`;
    if (!songTitle || seen.has(identity)) continue;
    seen.add(identity);
    songs.push({ id, songTitle, movieTitle });
  }
  if (candidates.length > 0 && songs.length === 0) {
    throw new Error('The suggestions catalog uses an outdated format.');
  }
  return songs;
}

export function getSongCatalog(): Promise<SongSuggestion[]> {
  catalogPromise ??= fetch('/api/suggestions', {
    method: 'GET',
    cache: 'no-cache',
    credentials: 'same-origin',
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Unable to download suggestions catalog (${response.status}).`);
    return parseCatalog(await response.json());
  }).catch((error: unknown) => {
    catalogPromise = null;
    throw error;
  });
  return catalogPromise;
}
