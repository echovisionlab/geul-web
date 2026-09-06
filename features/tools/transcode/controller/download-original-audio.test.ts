// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadOriginalAudio } from './download-original-audio';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('original audio download', () => {
  it('hands a validated source to the native download without fetching its body', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal('fetch', fetcher);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('원본.webm');
      expect(this.href).toBe(`${window.location.origin}/source?download=1`);
      expect(this.isConnected).toBe(true);
    });
    const signal = new AbortController().signal;
    await expect(downloadOriginalAudio('/source?download=1', '원본.webm', signal)).resolves.toBe('started');
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}/source?download=1`, {
      method: 'HEAD',
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a')).toBeNull();
  });

  it.each([404, 410, 502])('keeps HTTP %i failures on the tool page', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await expect(downloadOriginalAudio('/source', 'audio.webm', new AbortController().signal)).resolves.toBe(
      status === 502 ? 'failed' : 'expired',
    );
    expect(click).not.toHaveBeenCalled();
  });

  it('does not start a download after the source was removed during preflight', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        controller.abort();
        return new Response(null);
      }),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await expect(downloadOriginalAudio('/source', 'audio.webm', controller.signal)).rejects.toThrow();
    expect(click).not.toHaveBeenCalled();
  });
});
