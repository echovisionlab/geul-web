// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { FileDownloadAction, FileDownloadAvailability } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useContentMediaDelivery } from '@/features/media/ContentMediaDeliveryContext';
import { WorkMediaDeliveryProvider } from './WorkMediaDeliveryContext';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe({ onResult }: { onResult: (value: unknown) => void }) {
  const media = useContentMediaDelivery();
  return (
    <button
      type="button"
      onClick={() => void media?.authorizeDownload({ blockId: 'image-block', referencePath: 'file' }).then(onResult)}
    >
      Refresh
    </button>
  );
}

describe('WorkMediaDeliveryProvider', () => {
  it('refreshes an exact Work Block relation with share credentials kept in the internal request', async () => {
    const result = {
      access: {
        availability: FileDownloadAvailability.AVAILABLE,
        action: FileDownloadAction.DOWNLOAD,
      },
      download: { url: 'https://signed.example/original.png' },
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(result), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const onResult = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <WorkMediaDeliveryProvider
          idOrSlug="shared-work"
          requestedLocale="ko"
          shareToken="share-token"
          sharePassword="secret"
        >
          <Probe onResult={onResult} />
        </WorkMediaDeliveryProvider>,
      );
    });
    await act(async () => {
      host.querySelector('button')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/work/media-download',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          idOrSlug: 'shared-work',
          requestedLocale: 'ko',
          shareToken: 'share-token',
          sharePassword: 'secret',
          selector: { blockId: 'image-block', referencePath: 'file' },
        }),
      }),
    );
    expect(onResult).toHaveBeenCalledWith(result);
    expect(onResult.mock.calls[0]?.[0]).not.toHaveProperty('shareToken');
    expect(onResult.mock.calls[0]?.[0]).not.toHaveProperty('sharePassword');

    await act(async () => root.unmount());
    host.remove();
  });
});
