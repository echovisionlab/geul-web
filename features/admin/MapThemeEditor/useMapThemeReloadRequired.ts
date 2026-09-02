'use client';

import { useCallback, useEffect, useState } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';

export function useMapThemeReloadRequired(provider: HocuspocusProvider | null) {
  const [reloadRequired, setReloadRequired] = useState(false);

  const requireReload = useCallback(() => {
    setReloadRequired(true);
    provider?.disconnect();
  }, [provider]);

  useEffect(() => {
    if (!provider) {
      return;
    }

    const handleStateless = ({ payload }: { payload: string }) => {
      try {
        const signal = JSON.parse(payload) as { kind?: string };
        if (signal.kind === 'reload_required') {
          requireReload();
        }
      } catch {
        // Stateless messages for other collaboration features are ignored here.
      }
    };

    provider.on('stateless', handleStateless);
    return () => {
      provider.off('stateless', handleStateless);
    };
  }, [provider, requireReload]);

  return { reloadRequired, requireReload };
}
