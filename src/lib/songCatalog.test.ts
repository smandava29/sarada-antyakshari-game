import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('R2 song catalog', () => {
  it('accepts snake_case entries without public UUIDs and keeps duplicate titles from different movies', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      songs: [
        { song_title: 'Same title', movie_title: 'Movie A' },
        { song_title: 'Same title', movie_title: 'Movie B' },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const { getSongCatalog } = await import('./songCatalog');
    const songs = await getSongCatalog();

    expect(songs).toEqual([
      { id: null, songTitle: 'Same title', movieTitle: 'Movie A' },
      { id: null, songTitle: 'Same title', movieTitle: 'Movie B' },
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('/api/suggestions', expect.objectContaining({ method: 'GET' }));
  });
});
