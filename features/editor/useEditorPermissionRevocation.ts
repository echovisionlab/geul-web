'use client';

import { useCallback, useEffect, useState } from 'react';
import type { HocuspocusProvider, onAuthenticationFailedParameters, onStatelessParameters } from '@hocuspocus/provider';
import { decodeEditorInterruptionSignal } from './editorInterruptionSignal';

export type EditorAccessInterruption = 'permission_revoked' | 'session_expired';

export function useEditorPermissionRevocation(
  provider: HocuspocusProvider | null,
  _entityType: 'post' | 'page' | 'work' | 'artist' | 'label' | 'map-theme' | 'campaign',
  _entityId: string,
  relatedProvider: HocuspocusProvider | null = null,
) {
  const [interruption, setInterruption] = useState<EditorAccessInterruption | null>(null);

  const interrupt = useCallback(
    (reason: EditorAccessInterruption) => {
      setInterruption((current) => current ?? reason);
      provider?.disconnect();
      if (relatedProvider !== provider) {
        relatedProvider?.disconnect();
      }
    },
    [provider, relatedProvider],
  );

  const revoke = useCallback(() => interrupt('permission_revoked'), [interrupt]);

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
      if (signal?.kind === 'permission_revoked') {
        revoke();
      } else if (signal?.kind === 'session_expired') {
        interrupt('session_expired');
      }
    };
    const handleAuthenticationFailed = ({ reason }: onAuthenticationFailedParameters) => {
      if (reason === 'session_expired') {
        interrupt('session_expired');
      }
    };
    providers.forEach((candidate) => {
      candidate.on('stateless', handleStateless);
      candidate.on('authenticationFailed', handleAuthenticationFailed);
    });
    return () => {
      providers.forEach((candidate) => {
        candidate.off('stateless', handleStateless);
        candidate.off('authenticationFailed', handleAuthenticationFailed);
      });
    };
  }, [interrupt, provider, relatedProvider, revoke]);

  return {
    blocked: interruption !== null,
    interruption,
    revoked: interruption === 'permission_revoked',
    sessionExpired: interruption === 'session_expired',
    revoke,
  };
}
