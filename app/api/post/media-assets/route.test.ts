import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({ getPostView: vi.fn(), getPostViewWithToken: vi.fn() }));
vi.mock('@/lib/queries/post', () => mocks);

const post = {
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
  return new Request('http://localhost/api/post/media-assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/post/media-assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPostView.mockResolvedValue(post);
    mocks.getPostViewWithToken.mockResolvedValue(post);
  });

  it('re-reads the owning Post and returns stable public assets without refresh metadata', async () => {
    const response = await POST(request({ idOrSlug: 'shared', shareToken: 'token', sharePassword: 'secret' }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      media: { 'file-1': { imageUrl: 'https://cdn.example/image.webp', hlsUrl: 'https://media.example/master.m3u8' } },
    });
    expect(mocks.getPostViewWithToken).toHaveBeenCalledWith('shared', 'token', undefined, 'secret');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
  });
});
