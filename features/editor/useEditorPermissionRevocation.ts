'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HocuspocusProvider, onAuthenticationFailedParameters, onStatelessParameters } from '@hocuspocus/provider';
import { decodeEditorInterruptionSignal } from './editorInterruptionSignal';
import { useEditorAccessLevel } from './useEditorAccessLevel';
import {
  accessEndedReasonFromAuthenticationFailure,
  claimProviderInterruptionHandling,
  endProviderAccess,
  getProviderAccessEnded,
  subscribeToCollaborationAccessEnded,
} from '@/lib/collab/provider-control-state';

export type EditorAccessInterruption = 'permission_revoked' | 'session_expired';

export function useEditorPermissionRevocation(
  provider: HocuspocusProvider | null,
  _entityType: 'post' | 'page' | 'work' | 'artist' | 'label' | 'map-theme' | 'campaign',
  _entityId: string,
  relatedProvider: HocuspocusProvider | null = null,
) {
  const [interruption, setInterruption] = useState<EditorAccessInterruption | null>(null);

  // endProviderAccess notifies this hook's own access-ended subscription synchronously.
  const interrupting = useRef(false);
  const interrupt = useCallback(
    (reason: EditorAccessInterruption) => {
      setInterruption((current) => current ?? reason);
      if (interrupting.current) {
        return;
      }
      interrupting.current = true;
      try {
        if (provider) {
          endProviderAccess(provider, reason);
        }
        provider?.disconnect();
        if (relatedProvider !== provider) {
          relatedProvider?.disconnect();
        }
      } finally {
        interrupting.current = false;
      }
    },
    [provider, relatedProvider],
  );

  const revoke = useCallback(() => interrupt('permission_revoked'), [interrupt]);

  // This editor renders its own interruption dialogs; the app-wide fallback stays quiet for it.
  useEffect(() => {
    const releases = [provider, relatedProvider]
      .filter(
        (candidate, index, values): candidate is HocuspocusProvider =>
          !!candidate && values.indexOf(candidate) === index,
      )
      .map(claimProviderInterruptionHandling);
    return () => releases.forEach((release) => release());
  }, [provider, relatedProvider]);

  useEffect(() => {
    const providers = [provider, relatedProvider].filter(
      (candidate, index, values): candidate is HocuspocusProvider =>
        candidate !== null && values.indexOf(candidate) === index,
    );
    if (providers.length === 0) {
      return;
    }
    for (const candidate of providers) {
      const reason = getProviderAccessEnded(candidate);
      if (reason) {
        interrupt(reason);
      }
    }
    const handleStateless = ({ payload }: onStatelessParameters) => {
      const signal = decodeEditorInterruptionSignal(payload);
      if (signal?.reason === 'permission_revoked') {
        revoke();
      } else if (signal?.reason === 'session_expired') {
        interrupt('session_expired');
      }
    };
    // A refused readmission: an expired session or removed access.
    const handleAuthenticationFailed = ({ reason }: onAuthenticationFailedParameters) => {
      const ended = accessEndedReasonFromAuthenticationFailure(reason);
      if (ended) {
        interrupt(ended);
      }
    };
    providers.forEach((candidate) => {
      candidate.on('stateless', handleStateless);
      candidate.on('authenticationFailed', handleAuthenticationFailed);
    });
    // Access ended elsewhere, e.g. by the room connection for a provider this editor shows.
    const unsubscribeEnded = subscribeToCollaborationAccessEnded((reason, ended) => {
      if (providers.some((candidate) => candidate === ended)) {
        interrupt(reason);
      }
    });
    return () => {
      unsubscribeEnded();
      providers.forEach((candidate) => {
        candidate.off('stateless', handleStateless);
        candidate.off('authenticationFailed', handleAuthenticationFailed);
      });
    };
  }, [interrupt, provider, relatedProvider, revoke]);

  // Downgraded to view: the page stays open and readable, but editing stops in place.
  const accessLevel = useEditorAccessLevel(provider, relatedProvider);
  return {
    blocked: interruption !== null || accessLevel === 'view',
    viewOnly: interruption === null && accessLevel === 'view',
    interruption,
    revoked: interruption === 'permission_revoked',
    sessionExpired: interruption === 'session_expired',
    revoke,
  };
}
