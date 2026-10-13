// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_HOME_OG_CONFIG } from '@/lib/utils/og-config';
import { useOgPreview } from './useOgPreview';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('OG preview service availability', () => {
  it('does not request an unavailable service and preserves the default production request', async () => {
    const fetchPreview = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['image']) });
    vi.stubGlobal('fetch', fetchPreview);
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => 'blob:preview');
        static revokeObjectURL = vi.fn();
      },
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const host = document.createElement('div');
    const root = createRoot(host);
    function Preview({ enabled }: { enabled?: boolean }) {
      const preview = useOgPreview({ type: 'home', config: DEFAULT_HOME_OG_CONFIG }, enabled);
      return <span>{preview.previewUrl}</span>;
    }
    try {
      await act(async () =>
        root.render(
          <QueryClientProvider client={client}>
            <Preview enabled={false} />
          </QueryClientProvider>,
        ),
      );
      expect(fetchPreview).not.toHaveBeenCalled();
      await act(async () =>
        root.render(
          <QueryClientProvider client={client}>
            <Preview />
          </QueryClientProvider>,
        ),
      );
      await vi.waitFor(() => expect(fetchPreview).toHaveBeenCalledOnce());
      expect(fetchPreview).toHaveBeenCalledWith('/api/og-preview', expect.objectContaining({ method: 'POST' }));
    } finally {
      act(() => root.unmount());
      client.clear();
      vi.unstubAllGlobals();
    }
  });
});
