// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { PublicMediaEntityType } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentMediaDeliveryProvider, useContentMediaDelivery } from '@/features/media/ContentMediaDeliveryContext';
import { PageMediaDeliveryProvider } from './PageMediaDeliveryContext';

afterEach(() => vi.unstubAllGlobals());

describe('PageMediaDeliveryProvider server wrapper', () => {
  it('forwards the generated PAGE identity, endpoints, full share context, and children unchanged', () => {
    const children = <span>Page content</span>;
    const element = PageMediaDeliveryProvider({
      idOrSlug: 'shared%20page',
      requestedLocale: 'ko',
      shareToken: 'share-token',
      sharePassword: ' password ',
      children,
    });

    expect(element.type).toBe(ContentMediaDeliveryProvider);
    expect(element.props).toEqual({
      idOrSlug: 'shared%20page',
      requestedLocale: 'ko',
      shareToken: 'share-token',
      sharePassword: ' password ',
      mediaAssetsEndpoint: '/api/page/media-assets',
      mediaDownloadEndpoint: '/api/page/media-download',
      entityType: PublicMediaEntityType.PAGE,
      children,
    });
    expect(element.props.children).toBe(children);
  });

  it('preserves absent share credentials on the homepage', () => {
    const element = PageMediaDeliveryProvider({ idOrSlug: '/', requestedLocale: 'en', children: null });

    expect(element.props).toMatchObject({
      idOrSlug: '/',
      requestedLocale: 'en',
      shareToken: undefined,
      sharePassword: undefined,
      entityType: PublicMediaEntityType.PAGE,
      children: null,
    });
  });

  it('retains Page download authorization and asset lookup requests through the actual client context', async () => {
    const selector = { blockId: '01b3db42-75f1-4bf1-8cb9-9b3baf57e795', referencePath: 'file' };
    const fileId = 'b67328c4-668c-5bf2-8f1e-41465149ded6';
    const fetchMock = vi.fn(async (endpoint: string) => ({
      ok: true,
      json: async () =>
        endpoint === '/api/page/media-download'
          ? { download: { url: 'https://media.example/original' } }
          : {
              media: {
                [fileId]: { imageUrl: 'https://media.example/image', hlsUrl: 'https://media.example/video.m3u8' },
              },
            },
    }));
    vi.stubGlobal('fetch', fetchMock);
    let delivery: ReturnType<typeof useContentMediaDelivery>;
    function Probe() {
      delivery = useContentMediaDelivery();
      return <span>Media child</span>;
    }
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      act(() =>
        root.render(
          <PageMediaDeliveryProvider
            idOrSlug="shared-page"
            requestedLocale="ko"
            shareToken="share-token"
            sharePassword="password"
          >
            <Probe />
          </PageMediaDeliveryProvider>,
        ),
      );
      expect(container.textContent).toBe('Media child');
      expect(delivery!.entityType).toBe(PublicMediaEntityType.PAGE);
      expect(delivery!.entityId).toBe('shared-page');
      await expect(delivery!.authorizeDownload(selector)).resolves.toEqual({
        download: { url: 'https://media.example/original' },
      });
      await expect(
        Promise.all([delivery!.resolveAsset(fileId, 'image'), delivery!.resolveAsset(fileId, 'video')]),
      ).resolves.toEqual(['https://media.example/image', 'https://media.example/video.m3u8']);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const context = {
        idOrSlug: 'shared-page',
        requestedLocale: 'ko',
        shareToken: 'share-token',
        sharePassword: 'password',
      };
      expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/page/media-download', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...context, selector }),
      });
      expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/page/media-assets', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      });
    } finally {
      act(() => root.unmount());
    }
  });
});
