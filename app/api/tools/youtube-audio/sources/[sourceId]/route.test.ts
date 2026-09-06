import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSubject: vi.fn(),
  getService: vi.fn(),
  read: vi.fn(),
  revoke: vi.fn(),
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
  getYoutubeAudioService: mocks.getService,
}));

import { DELETE, GET, HEAD } from './route';
import {
  encryptYoutubeAudioSourceRecord,
  youtubeAudioSourceCookieName,
} from '@/features/tools/youtube-audio/server/source-cookie';

const context = { params: Promise.resolve({ sourceId: 'source_12345678' }) };
const record = {
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
};
const ticket = encryptYoutubeAudioSourceRecord(record, 'test-encryption-secret-32-characters');
const cookie = `${youtubeAudioSourceCookieName(record.id)}=${ticket}`;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSubject.mockResolvedValue('member-1');
  mocks.getService.mockReturnValue({ read: mocks.read, revoke: mocks.revoke });
  mocks.read.mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'Content-Range': 'bytes 0-2/123' },
      status: 206,
    }),
  );
  mocks.revoke.mockResolvedValue(undefined);
});

describe('/api/tools/youtube-audio/sources/[sourceId]', () => {
  it('preserves a resumed download range and safely encodes a Unicode filename', async () => {
    const unicodeRecord = { ...record, upstream: { ...record.upstream, fileName: '원본 "오디오".m4a' } };
    const unicodeTicket = encryptYoutubeAudioSourceRecord(unicodeRecord, 'test-encryption-secret-32-characters');
    const response = await GET(
      new Request('https://www.example.invalid/api/tools/youtube-audio/sources/source_12345678?download=1', {
        headers: { Cookie: `${youtubeAudioSourceCookieName(record.id)}=${unicodeTicket}`, Range: 'bytes=10-' },
      }),
      context,
    );
    expect(mocks.read).toHaveBeenCalledWith(expect.objectContaining({ range: 'bytes=10-122' }));
    expect(response.status).toBe(206);
    expect(response.headers.get('content-disposition')).toContain(encodeURIComponent(unicodeRecord.upstream.fileName));
    await response.body?.cancel();
  });

  it.each([GET, HEAD])('requires authentication for native downloads and preflights', async (handler) => {
    mocks.getSubject.mockResolvedValue(null);
    const response = await handler(
      new Request('https://www.example.invalid/api/tools/youtube-audio/sources/source_12345678?download=1'),
      context,
    );
    expect(response.status).toBe(404);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it.each([123, 2 * 1024 ** 3])(
    'streams a %i-byte original without buffering or changing the filename',
    async (size) => {
      const source = { ...record, upstream: { ...record.upstream, size } };
      const sourceTicket = encryptYoutubeAudioSourceRecord(source, 'test-encryption-secret-32-characters');
      const cancel = vi.fn();
      const pull = vi.fn();
      const body = new ReadableStream({ pull, cancel }, { highWaterMark: 0 });
      mocks.read.mockResolvedValue(
        new Response(body, {
          status: 206,
          headers: {
            'Content-Range': `bytes 0-${size - 1}/${size}`,
            'Content-Length': String(size),
            'Content-Type': 'audio/mp4',
          },
        }),
      );
      const request = new Request(
        'https://www.example.invalid/api/tools/youtube-audio/sources/source_12345678?download=1',
        {
          headers: { Cookie: `${youtubeAudioSourceCookieName(record.id)}=${sourceTicket}` },
        },
      );
      const response = await GET(request, context);
      expect(mocks.read).toHaveBeenCalledWith(
        expect.objectContaining({ range: `bytes=0-${size - 1}`, subject: 'member-1', signal: request.signal }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('content-disposition')).toContain("filename*=UTF-8''Reference.m4a");
      expect(response.headers.get('content-type')).toBe('audio/mp4');
      expect(response.headers.get('content-length')).toBe(String(size));
      expect(response.headers.has('content-range')).toBe(false);
      expect(response.body).toBe(body);
      expect(pull).not.toHaveBeenCalled();
      await response.body?.cancel();
      expect(cancel).toHaveBeenCalledOnce();
    },
  );

  it('preflights only one byte and cancels the upstream body', async () => {
    const cancel = vi.fn();
    mocks.read.mockResolvedValue(new Response(new ReadableStream({ cancel })));
    const response = await HEAD(
      new Request('https://www.example.invalid/api/tools/youtube-audio/sources/source_12345678?download=1', {
        headers: { Cookie: cookie },
      }),
      context,
    );
    expect(mocks.read).toHaveBeenCalledWith(expect.objectContaining({ range: 'bytes=0-0' }));
    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('does not turn a rejected source into a successful attachment', async () => {
    mocks.read.mockRejectedValue(new Error('expired or unauthorized'));
    const response = await GET(
      new Request('https://www.example.invalid/api/tools/youtube-audio/sources/source_12345678?download=1', {
        headers: { Cookie: cookie },
      }),
      context,
    );
    expect(response.ok).toBe(false);
    expect(response.headers.has('content-disposition')).toBe(false);
  });

  it('forwards the exact browser byte range with the authenticated Member', async () => {
    const request = new Request('https://www.example.invalid/api/tools/youtube-audio/sources/source_12345678', {
      headers: { Cookie: cookie, Range: 'bytes=0-2' },
    });
    const response = await GET(request, context);
    expect(mocks.read).toHaveBeenCalledWith({
      range: 'bytes=0-2',
      signal: request.signal,
      sourceId: 'source_12345678',
      subject: 'member-1',
    });
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 0-2/123');
    expect(mocks.getService).toHaveBeenCalledWith('https://www.example.invalid', expect.anything());
    const sourceStore = mocks.getService.mock.calls[0]?.[1] as { get: (id: string) => Promise<unknown> };
    await expect(sourceStore.get(record.id)).resolves.toEqual(record);
  });

  it('revokes only the authenticated Member source', async () => {
    const response = await DELETE(
      new Request('https://www.example.invalid/api/tools/youtube-audio/sources/source_12345678', {
        headers: { Cookie: cookie },
        method: 'DELETE',
      }),
      context,
    );
    expect(mocks.revoke).toHaveBeenCalledWith({ sourceId: 'source_12345678', subject: 'member-1' });
    expect(response.status).toBe(204);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const expiredCookie = response.headers.get('set-cookie');
    expect(expiredCookie).toContain('Max-Age=0');
    expect(expiredCookie).toContain('Path=/api/tools/youtube-audio/sources/source_12345678');
    expect(expiredCookie).not.toContain('Domain=');
  });

  it('rejects unauthenticated range reads before touching the source service', async () => {
    mocks.getSubject.mockResolvedValue(null);
    const response = await GET(
      new Request('https://www.example.invalid/api/tools/youtube-audio/sources/source_12345678'),
      context,
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'NOT_FOUND' });
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
