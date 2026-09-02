'use client';

import { useCallback, useEffect, useState } from 'react';
import type { HocuspocusProvider, onStatelessParameters } from '@hocuspocus/provider';
import { decodeEditorInterruptionSignal } from './editorInterruptionSignal';

export function useEditorReloadRequired(
  provider: HocuspocusProvider | null,
  relatedProvider: HocuspocusProvider | null = null,
) {
  const [reloadRequired, setReloadRequired] = useState(false);

  const requireReload = useCallback(() => {
    setReloadRequired(true);
    provider?.disconnect();
    if (relatedProvider !== provider) {
      relatedProvider?.disconnect();
    }
  }, [provider, relatedProvider]);

  useEffect(() => {
    const providers = [provider, relatedProvider].filter(
      (candidate, index, values): candidate is HocuspocusProvider =>
        candidate !== null && values.indexOf(candidate) === index,
    );
    if (providers.length === 0) {
      return;
    }

    const handleStateless = ({ payload }: onStatelessParameters) => {
      const signal = decodeEditorInterruptionSignal(payload);
      if (signal?.kind === 'reload_required') {
        requireReload();
      }
    };

    providers.forEach((candidate) => candidate.on('stateless', handleStateless));
    return () => {
      providers.forEach((candidate) => candidate.off('stateless', handleStateless));
    };
  }, [provider, relatedProvider, requireReload]);

  return { reloadRequired, requireReload };
}
