import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ContentBlockDownloadAction,
  ContentBlockDownloadAvailability,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { GET } from './route';

const mocks = vi.hoisted(() => ({
  getPageView: vi.fn(),
  getPostView: vi.fn(),
  getProgramEventView: vi.fn(),
  getWorkView: vi.fn(),
}));

vi.mock('@/lib/queries/page', () => ({ getPageView: mocks.getPageView }));
vi.mock('@/lib/queries/post', () => ({ getPostView: mocks.getPostView }));
vi.mock('@/lib/queries/program-event', () => ({ getProgramEventView: mocks.getProgramEventView }));
vi.mock('@/lib/queries/work', () => ({ getWorkView: mocks.getWorkView }));

function context(entityType = 'post', blockId = 'file-block-1') {
  return {
    params: Promise.resolve({ entityType, entityId: 'post-1', blockId, filename: 'field.wav' }),
  };
}

const fileBlock = {
  selector: { blockId: 'file-block-1', referencePath: 'file' },
  attachment: { state: { case: 'activeFileId', value: 'file-1' } },
  downloadAvailability: ContentBlockDownloadAvailability.AVAILABLE,
  downloadAction: ContentBlockDownloadAction.DOWNLOAD,
  delivery: { download: { url: 'https://signed.example/field.wav' } },
};

describe('GET content-scoped file URL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPostView.mockResolvedValue({ blockMedia: [fileBlock] });
  });

  it('re-reads the owning content and redirects an exact current file block', async () => {
    const response = await GET(new Request('http://localhost/files/post/post-1/file-block-1/field.wav'), context());

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://signed.example/field.wav');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(mocks.getPostView).toHaveBeenCalledWith('post-1');
  });

  it('does not authorize another block merely because it references the same file', async () => {
    const response = await GET(
      new Request('http://localhost/files/post/post-1/removed-block/field.wav'),
      context('post', 'removed-block'),
    );

    expect(response.status).toBe(404);
  });

  it('keeps a visible but unavailable file from issuing a signed redirect', async () => {
    mocks.getPostView.mockResolvedValue({
      blockMedia: [
        {
          ...fileBlock,
          downloadAction: ContentBlockDownloadAction.SIGN_IN,
          delivery: { download: { url: '' } },
        },
      ],
    });

    const response = await GET(new Request('http://localhost/files/post/post-1/file-block-1/field.wav'), context());
    expect(response.status).toBe(403);
  });

  it('finds exact file blocks inside nested Page sections', async () => {
    mocks.getPageView.mockResolvedValue({
      blockMedia: [fileBlock],
    });

    const response = await GET(
      new Request('http://localhost/files/page/post-1/file-block-1/field.wav'),
      context('page'),
    );
    expect(response.status).toBe(307);
    expect(mocks.getPageView).toHaveBeenCalledWith('post-1');
  });
});
