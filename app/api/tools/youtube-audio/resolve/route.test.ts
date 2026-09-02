import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSubject: vi.fn(),
  resolve: vi.fn(),
  record: {
    expiresAt: 2_000_000_000_000,
    id: 'source_12345678',
    subject: 'member-1',
    upstream: {
      contentType: 'audio/mp4',
      expiresAt: 2_000_000_100_000,
      fileName: 'Reference.m4a',
      size: 123,
      title: 'Reference',
      url: 'https://upstream.example.test/audio?token=secret',
      videoId: 'abcdefghijk',
    },
  },
}));

vi.mock('@/lib/env', () => ({
  env: { ENCRYPTION_SECRET: 'test-encryption-secret-32-characters', NODE_ENV: 'production' },
}));

vi.mock('@/lib/utils/url.server', () => ({ getBaseUrl: () => Promise.resolve('https://www.example.invalid') }));

vi.mock('@/features/tools/youtube-audio/server/http', () => ({
  getYoutubeAudioSubject: mocks.getSubject,
  toYoutubeAudioErrorResponse: () => Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 }),
  youtubeAudioNoStoreHeaders: { 'Cache-Control': 'private, no-store, max-age=0' },
  youtubeAudioNotFoundResponse: () => Response.json({ error: 'NOT_FOUND' }, { status: 404 }),
}));

vi.mock('@/features/tools/youtube-audio/server/service', () => ({
  getYoutubeAudioService: (_origin: string, sourceStore: { put: (record: unknown) => Promise<void> }) => ({
    resolve: async (request: unknown) => {
      const result = await mocks.resolve(request);
      await sourceStore.put(mocks.record);
      return result;
    },
  }),
}));

import { POST } from './route';

const resolved = {
  contentType: 'audio/mp4',
  expiresAt: 2_000_000_000_000,
  input: {
    http: {
      credentials: 'include',
      size: 123,
      url: 'https://www.example.invalid/api/tools/youtube-audio/sources/source_12345678',
    },
    name: 'Reference.m4a',
  },
  sourceId: 'source_12345678',
  title: 'Reference',
  videoId: 'abcdefghijk',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSubject.mockResolvedValue('member-1');
  mocks.resolve.mockResolvedValue(resolved);
});

describe('POST /api/tools/youtube-audio/resolve', () => {
  it('requires authentication before resolving a YouTube URL', async () => {
    mocks.getSubject.mockResolvedValue(null);
    const response = await POST(
      new Request('https://www.example.invalid/api/tools/youtube-audio/resolve', {
        body: JSON.stringify({ url: 'https://youtu.be/abcdefghijk' }),
        method: 'POST',
      }),
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'NOT_FOUND' });
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it('binds the resolved source to the authenticated Member and request origin', async () => {
    const request = new Request('https://www.example.invalid/api/tools/youtube-audio/resolve', {
      body: JSON.stringify({ url: 'https://youtu.be/abcdefghijk' }),
      method: 'POST',
    });
    const response = await POST(request);
    expect(mocks.resolve).toHaveBeenCalledWith({
      signal: request.signal,
      subject: 'member-1',
      url: 'https://youtu.be/abcdefghijk',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const cookie = response.headers.get('set-cookie');
    expect(cookie).toContain('geul_youtube_audio_source_12345678=');
    expect(cookie).toContain('Path=/api/tools/youtube-audio/sources/source_12345678');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie?.toLowerCase()).toContain('samesite=lax');
    expect(cookie).not.toContain('Domain=');
    expect(cookie).not.toContain('upstream.example.test');
    await expect(response.json()).resolves.toEqual(resolved);
  });
});
