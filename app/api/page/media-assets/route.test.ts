import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({ getPageView: vi.fn(), getPageViewWithToken: vi.fn() }));
vi.mock('@/lib/queries/page', () => mocks);

const page = {
  blockMedia: [
    {
      selector: { blockId: 'video-1', referencePath: 'file' },
      attachment: { state: { case: 'activeFileId', value: 'file-1' } },
      delivery: {
        asset: { url: 'https://cdn.example/image.webp' },
        playback: { url: 'https://media.example/master.m3u8' },
      },
    },
  ],
};

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/page/media-assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/page/media-assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPageView.mockResolvedValue(page);
    mocks.getPageViewWithToken.mockResolvedValue(page);
  });

  it('re-reads the owning Page and returns stable public assets without refresh metadata', async () => {
    const response = await POST(request({ idOrSlug: 'shared', shareToken: 'token', sharePassword: 'secret' }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      media: { 'file-1': { imageUrl: 'https://cdn.example/image.webp', hlsUrl: 'https://media.example/master.m3u8' } },
    });
    expect(mocks.getPageViewWithToken).toHaveBeenCalledWith('shared', 'token', undefined, 'secret');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
  });
});
