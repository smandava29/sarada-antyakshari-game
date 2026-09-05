import { beforeEach, describe, expect, it, vi } from 'vitest';

function successResponse(data: unknown): Response {
  return new Response(JSON.stringify({
    success: true,
    requestId: 'test-request',
    data,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('game API request minimization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.stubGlobal('navigator', { onLine: true });
  });

  it('deduplicates concurrent resume requests', async () => {
    const gameState = {
      questionDate: '2026-07-29',
      status: 'playing',
      attemptsUsed: 0,
      maxAttempts: 5,
      expiresAt: '2026-07-29T12:00:00.000Z',
      questionMedia: null,
      answer: null,
      resultMedia: null,
      history: [],
    };
    const fetchMock = vi.fn(async () => successResponse(gameState));
    vi.stubGlobal('fetch', fetchMock);
    const { gameApi } = await import('./gameApi');

    await Promise.all([
      gameApi.resume('same-session-token'),
      gameApi.resume('same-session-token'),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('deduplicates the bundled result-media request', async () => {
    const media = {
      cover: {
        asset: 'cover',
        signedUrl: '/api/media?token=cover-token',
        contentType: 'image/jpeg',
        expiresInSeconds: 300,
        expiresAt: '2026-07-29T12:05:00.000Z',
        refreshAt: '2026-07-29T12:04:00.000Z',
      },
      preview: {
        asset: 'preview',
        signedUrl: '/api/media?token=preview-token',
        contentType: 'audio/mpeg',
        expiresInSeconds: 300,
        expiresAt: '2026-07-29T12:05:00.000Z',
        refreshAt: '2026-07-29T12:04:00.000Z',
      },
    };
    const fetchMock = vi.fn(async () => successResponse(media));
    vi.stubGlobal('fetch', fetchMock);
    const { gameApi } = await import('./gameApi');

    const [first, second] = await Promise.all([
      gameApi.resultMediaUrls('session-token'),
      gameApi.resultMediaUrls('session-token'),
    ]);

    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not deduplicate sequential attempt mutations', async () => {
    const response = {
      questionDate: '2026-07-29',
      status: 'playing',
      attemptsUsed: 1,
      maxAttempts: 5,
      expiresAt: '2026-07-29T12:00:00.000Z',
      questionMedia: null,
      answer: null,
      attempt: {
        attemptNumber: 1,
        attemptType: 'skip',
        submittedSongId: null,
        wasCorrect: false,
        songTitle: null,
        movieTitle: null,
        createdAt: '2026-07-29T11:00:00.000Z',
      },
    };
    const fetchMock = vi.fn(async () => successResponse(response));
    vi.stubGlobal('fetch', fetchMock);
    const { gameApi } = await import('./gameApi');

    await gameApi.skip('session-token');
    await gameApi.skip('session-token');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('submits the selected song UUID instead of its non-unique title', async () => {
    const fetchMock = vi.fn(async () => successResponse({
      status: 'playing',
      attemptsUsed: 1,
      attempt: {
        attemptNumber: 1,
        attemptType: 'guess',
        submittedSongId: '11111111-1111-1111-1111-111111111111',
        wasCorrect: false,
        songTitle: 'Duplicate title',
        movieTitle: 'Movie A',
        createdAt: '2026-07-29T11:00:00.000Z',
      },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { gameApi } = await import('./gameApi');

    await gameApi.guess(
      'session-token',
      {
        id: '11111111-1111-1111-1111-111111111111',
        songTitle: 'Duplicate title',
        movieTitle: 'Movie A',
      },
    );

    const firstCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    const request = firstCall?.[1] as RequestInit | undefined;
    expect(request).toBeDefined();
    expect(JSON.parse(String(request?.body))).toMatchObject({
      action: 'guess',
      songId: '11111111-1111-1111-1111-111111111111',
    });
  });
});
