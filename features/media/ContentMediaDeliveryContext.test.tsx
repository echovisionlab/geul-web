// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, renderHook } from '@/test/render';
import { afterEach, expect, it, vi } from 'vitest';
import { PublicMediaEntityType } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { ContentMediaDeliveryProvider, useContentMediaDelivery } from './ContentMediaDeliveryContext';

afterEach(() => vi.unstubAllGlobals());

it('isolates asset lookups by endpoint and locale and keeps the newer in-flight request shared after an old completion', async () => {
  const first = Promise.withResolvers<Response>();
  const second = Promise.withResolvers<Response>();
  const fetch = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  vi.stubGlobal('fetch', fetch);
  let locale = 'en';
  let endpoint = '/first-assets';
  const view = renderHook(() => useContentMediaDelivery()!, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ContentMediaDeliveryProvider
        idOrSlug="page"
        requestedLocale={locale}
        mediaAssetsEndpoint={endpoint}
        mediaDownloadEndpoint="/authorize"
        entityType={PublicMediaEntityType.PAGE}
      >
        {children}
      </ContentMediaDeliveryProvider>
    ),
  });
  const old = view.result.current.resolveAsset('file', 'image');
  locale = 'ko';
  endpoint = '/second-assets';
  view.rerender();
  const latest = view.result.current.resolveAsset('file', 'image');
  await act(async () => first.resolve(Response.json({ media: { file: { imageUrl: '/old.webp' } } })));
  expect(await old).toBe('/old.webp');
  const shared = view.result.current.resolveAsset('file', 'video');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenLastCalledWith(
    '/second-assets',
    expect.objectContaining({ body: JSON.stringify({ idOrSlug: 'page', requestedLocale: 'ko' }) }),
  );
  await act(async () =>
    second.resolve(Response.json({ media: { file: { imageUrl: '/new.webp', hlsUrl: '/new.m3u8' } } })),
  );
  expect(await latest).toBe('/new.webp');
  expect(await shared).toBe('/new.m3u8');
});
