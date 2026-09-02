// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCollaborativeFeaturedImage } from './useCollaborativeFeaturedImage';

const { getMediaDeliveryMock, loggerWarnMock } = vi.hoisted(() => ({
  getMediaDeliveryMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}));

vi.mock('@/lib/api/browser-client', () => ({
  createFileClient: () => ({ getMediaDelivery: getMediaDeliveryMock }),
}));

vi.mock('@/lib/utils/client-logger', () => ({
  createClientLogger: () => ({ warn: loggerWarnMock }),
}));

interface HarnessProps {
  entityKey: string;
  fileId: string | null | undefined;
  initialUrl: string | null;
  enabled: boolean;
}

let latest: ReturnType<typeof useCollaborativeFeaturedImage> | null = null;
let container: HTMLDivElement;
let root: Root;

function Harness(props: HarnessProps) {
  latest = useCollaborativeFeaturedImage(props);
  return null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function delivery(url: string) {
  return { delivery: { asset: { url } } };
}

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  latest = null;
  getMediaDeliveryMock.mockReset();
  loggerWarnMock.mockReset();
  vi.useRealTimers();
});

describe('useCollaborativeFeaturedImage', () => {
  it('preserves the initial manage URL for a missing file ID and clears explicit null', () => {
    act(() => {
      root.render(
        <Harness
          entityKey="post:post-1"
          fileId={undefined}
          initialUrl="https://example.com/manage-cover.jpg"
          enabled
        />,
      );
    });

    expect(latest?.featuredImageUrl).toBe('https://example.com/manage-cover.jpg');
    expect(getMediaDeliveryMock).not.toHaveBeenCalled();

    act(() => {
      root.render(
        <Harness entityKey="post:post-1" fileId={null} initialUrl="https://example.com/manage-cover.jpg" enabled />,
      );
    });

    expect(latest?.featuredImageUrl).toBeNull();
    expect(getMediaDeliveryMock).not.toHaveBeenCalled();
  });

  it('hydrates the latest remote file ID and ignores an older response', async () => {
    const first = deferred<ReturnType<typeof delivery>>();
    const second = deferred<ReturnType<typeof delivery>>();
    getMediaDeliveryMock.mockImplementation(({ fileId }: { fileId: string }) =>
      fileId === 'file-a' ? first.promise : second.promise,
    );

    act(() => {
      root.render(
        <Harness entityKey="work:work-1" fileId="file-a" initialUrl="https://example.com/manage-cover.jpg" enabled />,
      );
    });
    expect(latest?.featuredImageUrl).toBeNull();
    act(() => {
      root.render(
        <Harness entityKey="work:work-1" fileId="file-b" initialUrl="https://example.com/manage-cover.jpg" enabled />,
      );
    });

    await act(async () => {
      second.resolve(delivery('https://example.com/file-b.jpg'));
      await second.promise;
    });
    expect(latest?.featuredImageUrl).toBe('https://example.com/file-b.jpg');

    await act(async () => {
      first.resolve(delivery('https://example.com/file-a.jpg'));
      await first.promise;
    });
    expect(latest?.featuredImageUrl).toBe('https://example.com/file-b.jpg');

    act(() => {
      root.render(
        <Harness
          entityKey="work:work-1"
          fileId={undefined}
          initialUrl="https://example.com/manage-cover.jpg"
          enabled
        />,
      );
    });
    expect(latest?.featuredImageUrl).toBe('https://example.com/manage-cover.jpg');
  });

  it('keeps the current URL and logs when hydration fails', async () => {
    getMediaDeliveryMock.mockRejectedValue(new Error('delivery unavailable'));

    act(() => {
      root.render(
        <Harness entityKey="post:post-1" fileId="file-a" initialUrl="https://example.com/manage-cover.jpg" enabled />,
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_250);
    });

    expect(latest?.featuredImageUrl).toBeNull();
    expect(getMediaDeliveryMock).toHaveBeenCalledTimes(3);
    expect(loggerWarnMock).toHaveBeenCalledWith('Failed to hydrate collaborative featured image', {
      entityKey: 'post:post-1',
      fileId: 'file-a',
      error: 'delivery unavailable',
    });
  });

  it('does not let an in-flight remote response replace a locally hydrated image', async () => {
    const remote = deferred<ReturnType<typeof delivery>>();
    getMediaDeliveryMock.mockReturnValue(remote.promise);

    act(() => {
      root.render(
        <Harness
          entityKey="post:post-1"
          fileId="remote-file"
          initialUrl="https://example.com/manage-cover.jpg"
          enabled
        />,
      );
    });

    act(() => {
      latest?.setFeaturedImage('local-file', 'https://example.com/local-file.jpg');
    });

    await act(async () => {
      remote.resolve(delivery('https://example.com/remote-file.jpg'));
      await remote.promise;
    });

    expect(latest?.featuredImageUrl).toBe('https://example.com/local-file.jpg');
  });

  it('retries missing delivery URLs and hydrates a later successful response', async () => {
    getMediaDeliveryMock
      .mockResolvedValueOnce({ delivery: {} })
      .mockResolvedValueOnce(delivery('https://example.com/retried-file.jpg'));

    act(() => {
      root.render(
        <Harness entityKey="post:post-1" fileId="file-a" initialUrl="https://example.com/manage-cover.jpg" enabled />,
      );
    });

    expect(latest?.featuredImageUrl).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(getMediaDeliveryMock).toHaveBeenCalledTimes(2);
    expect(latest?.featuredImageUrl).toBe('https://example.com/retried-file.jpg');
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  it('retries when a local action has no URL', async () => {
    getMediaDeliveryMock.mockResolvedValue(delivery('https://example.com/local-file.jpg'));

    act(() => {
      root.render(
        <Harness
          entityKey="post:post-1"
          fileId={undefined}
          initialUrl="https://example.com/manage-cover.jpg"
          enabled
        />,
      );
    });

    act(() => {
      latest?.setFeaturedImage('local-file', null);
      root.render(
        <Harness
          entityKey="post:post-1"
          fileId="local-file"
          initialUrl="https://example.com/manage-cover.jpg"
          enabled
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getMediaDeliveryMock).toHaveBeenCalledWith({ fileId: 'local-file' });
    expect(latest?.featuredImageUrl).toBe('https://example.com/local-file.jpg');
  });

  it('does not cache a delivery without a display URL as hydrated', async () => {
    getMediaDeliveryMock.mockResolvedValue({ delivery: {} });

    act(() => {
      root.render(
        <Harness entityKey="work:work-1" fileId="file-a" initialUrl="https://example.com/manage-cover.jpg" enabled />,
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_250);
    });

    expect(latest?.featuredImageUrl).toBeNull();
    expect(getMediaDeliveryMock).toHaveBeenCalledTimes(3);
    expect(loggerWarnMock).toHaveBeenCalledWith('Collaborative featured image delivery has no display URL', {
      entityKey: 'work:work-1',
      fileId: 'file-a',
    });

    act(() => {
      root.render(
        <Harness
          entityKey="work:work-1"
          fileId="file-a"
          initialUrl="https://example.com/refreshed-manage-cover.jpg"
          enabled
        />,
      );
    });

    expect(getMediaDeliveryMock).toHaveBeenCalledTimes(4);
  });
});
