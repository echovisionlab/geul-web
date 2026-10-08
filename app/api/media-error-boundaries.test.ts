import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as pageAssets } from './page/media-assets/route';
import { POST as pageDownload } from './page/media-download/route';
import { POST as postAssets } from './post/media-assets/route';
import { POST as postDownload } from './post/media-download/route';
import { POST as workDownload } from './work/media-download/route';
import { POST as releaseDownload } from './release/media-download/route';

const queries = vi.hoisted(() => ({ page: vi.fn(), post: vi.fn(), work: vi.fn(), release: vi.fn() }));
vi.mock('@/lib/queries/page', () => ({ getPageView: queries.page, getPageViewWithToken: queries.page }));
vi.mock('@/lib/queries/post', () => ({ getPostView: queries.post, getPostViewWithToken: queries.post }));
vi.mock('@/lib/queries/work', () => ({ getWorkView: queries.work, getWorkViewWithShareToken: queries.work }));
vi.mock('@/lib/queries/release', () => ({ getReleasePublic: queries.release }));
vi.mock('@/lib/utils/logger', () => ({ createLogger: () => ({ error: vi.fn() }) }));
beforeEach(() => vi.resetAllMocks());

for (const [name, handler, query] of [
  ['page assets', pageAssets, queries.page],
  ['page download', pageDownload, queries.page],
  ['post assets', postAssets, queries.post],
  ['post download', postDownload, queries.post],
  ['work download', workDownload, queries.work],
  ['release download', releaseDownload, queries.release],
] as const) {
  describe(name, () => {
    for (const shareToken of ['', 'shared-token']) {
      it.each([
        [Code.PermissionDenied, 403],
        [Code.ResourceExhausted, 429],
        [Code.Unavailable, 503],
        [Code.DeadlineExceeded, 504],
        [Code.Internal, 500],
      ])(`preserves failure status with shareToken=${shareToken}`, async (code, status) => {
        query.mockRejectedValue(new ConnectError('private dependency details', code));
        const response = await handler(
          new Request('https://www.dsub.io/api/media', {
            method: 'POST',
            body: JSON.stringify({
              idOrSlug: 'owner',
              shareToken,
              trackId: 'track',
              selector: { blockId: 'block', referencePath: 'file' },
            }),
          }),
        );
        expect(response.status).toBe(status);
        expect(await response.text()).not.toContain('private');
      });
    }
    it('returns 404 when the owner really does not exist', async () => {
      query.mockResolvedValue(null);
      const response = await handler(
        new Request('https://www.dsub.io/api/media', {
          method: 'POST',
          body: JSON.stringify({
            idOrSlug: 'missing',
            trackId: 'track',
            selector: { blockId: 'block', referencePath: 'file' },
          }),
        }),
      );
      expect(response.status).toBe(404);
    });
  });
}
