import { describe, expect, it, vi } from 'vitest';
import { YoutubeAudioError } from '@echovisionlab/youtube-audio';

vi.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({ error: vi.fn() }),
}));
vi.mock('@/lib/auth', () => ({ getSessionFromCookie: vi.fn() }));

import { toYoutubeAudioErrorResponse, youtubeAudioNotFoundResponse } from './http';

describe('YouTube audio HTTP privacy boundary', () => {
  it('uses an indistinguishable not-found response when no Session exists', async () => {
    const response = youtubeAudioNotFoundResponse();

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toContain('no-store');
    await expect(response.json()).resolves.toEqual({ error: 'NOT_FOUND' });
  });

  it('maps a source subject mismatch to not found', async () => {
    const response = toYoutubeAudioErrorResponse(new YoutubeAudioError('UNAUTHORIZED', 'Wrong subject'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'NOT_FOUND' });
  });
});
