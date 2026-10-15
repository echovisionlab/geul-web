'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { notifications } from '@/components/core/Notification';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { NavigationIntentProvider, type NavigationIntent } from '@/components/core/Navigation';
import { confirmDialogs } from '@/components/core/Modal/confirm-dialogs';
import {
  flushAllEditorSaves,
  getRejectedEditorSaves,
  hasPendingEditorSaves,
  hasRejectedEditorSaves,
  hasEditorSaveFailure,
  subscribeToEditorSaveState,
  subscribeToRestoredEditorEdits,
} from '@/lib/editor/editor-save-registry';
import { usePendingEditorUnload } from '@/lib/editor/usePendingEditorUnload';
import {
  isProviderInterruptionHandled,
  subscribeToCollaborationAccessEnded,
  subscribeToProviderAccessLevel,
} from '@/lib/collab/provider-control-state';
import type { AccessEndedReason } from '@echovisionlab/geul-common/collaboration/protocol';
import { BlockingAlertDialog } from '@/components/core/Modal';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { leaveOrResume, prepareToLeaveWithDurableEdits } from '@/lib/editor/leave-with-durable-edits';

interface EditorNavigationProviderProps {
  children: ReactNode;
}

export function EditorNavigationProvider({ children }: EditorNavigationProviderProps) {
  usePendingEditorUnload();
  const router = useRouter();
  const t = useTranslations('common.notifications');
  const tPermission = useTranslations('editorCommon.permissionRevoked');
  const tSession = useTranslations('editorCommon.sessionExpired');
  const tActions = useTranslations('common.actions');
  // Editors without their own interruption dialogs still must not keep editing a room whose
  // access ended: block the page and lead to sign-in (edits stay on this device) or away.
  const [endedAccess, setEndedAccess] = useState<AccessEndedReason | null>(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(
    () =>
      subscribeToCollaborationAccessEnded((reason, provider) => {
        if (!isProviderInterruptionHandled(provider)) {
          setEndedAccess((current) => current ?? reason);
        }
      }),
    [],
  );
  const tDowngraded = useTranslations('editorCommon.accessDowngraded');
  const tUpgraded = useTranslations('editorCommon.accessUpgraded');
  // Downgraded to view: the page stays open and readable (Notion keeps it), editing stops.
  // One access notice at a time: a later change replaces the earlier one (rooms of one editor
  // report the same change, and a granted edit access supersedes the view-only notice).
  const accessNotice = useRef<string | null>(null);
  // Latest router and messages for the long-lived subscription below (catalogue reloads give
  // new translator identities; re-subscribing must not drop the notice still on screen).
  const accessNoticeDeps = useRef({ router, tDowngraded, tUpgraded });
  accessNoticeDeps.current = { router, tDowngraded, tUpgraded };
  useEffect(() => {
    const unsubscribe = subscribeToProviderAccessLevel((access, _provider, changed) => {
      if (!changed) {
        return;
      }
      const deps = accessNoticeDeps.current;
      if (accessNotice.current) {
        notifications.hide(accessNotice.current);
        accessNotice.current = null;
      }
      if (access === 'view') {
        accessNotice.current = notifications.show({
          message: deps.tDowngraded('message'),
          tone: 'warning',
          autoClose: false,
        });
        return;
      }
      accessNotice.current = notifications.show({ message: deps.tUpgraded('message'), tone: 'positive' });
      // Granted edit while open: server-rendered permissions (publish, delete, ...) follow in
      // place, without reloading the page or losing editor state.
      deps.router.refresh();
    });
    return () => {
      unsubscribe();
      // Unmount only: the view-only notice does not close itself and must not outlive this provider.
      if (accessNotice.current) {
        notifications.hide(accessNotice.current);
        accessNotice.current = null;
      }
    };
  }, []);
  const leaveEndedAccess = () => {
    setLeaving(true);
    const resume = () => setLeaving(false);
    if (endedAccess === 'session_expired') {
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      void prepareToLeaveWithDurableEdits().finally(() =>
        leaveOrResume(() => window.location.assign(buildLoginRedirectHref(returnTo)), resume),
      );
    } else {
      leaveOrResume(() => window.location.assign('/'), resume);
    }
  };
  const failureNotice = useRef<string | null>(null);
  const showFailure = useCallback((message: string) => {
    failureNotice.current ??= notifications.show({ message, tone: 'danger', autoClose: false });
  }, []);
  useEffect(() => {
    const update = () => {
      if (hasEditorSaveFailure()) {
        showFailure(t('saveRetrying'));
      } else if (!hasPendingEditorSaves() && failureNotice.current) {
        notifications.hide(failureNotice.current);
        failureNotice.current = null;
      }
    };
    update();
    const unsubscribe = subscribeToEditorSaveState(undefined, update);
    const unsubscribeRestored = subscribeToRestoredEditorEdits(() => {
      notifications.show({ message: t('editsRestored'), tone: 'positive' });
    });
    return () => {
      unsubscribe();
      unsubscribeRestored();
      if (failureNotice.current) {
        notifications.hide(failureNotice.current);
      }
      failureNotice.current = null;
    };
  }, [showFailure, t]);

  const onNavigationIntent = useCallback(
    (intent: NavigationIntent, event: { preventDefault: () => void }) => {
      // Refused edits leave with their editor: never navigate past them without a decision.
      if (!hasPendingEditorSaves() && !hasRejectedEditorSaves()) {
        return;
      }

      event.preventDefault();

      const go = () => {
        const options = { scroll: intent.scroll };
        if (intent.replace) {
          router.replace(intent.href, options);
        } else {
          router.push(intent.href, options);
        }
      };

      void (async () => {
        let saved: boolean;
        try {
          saved = await flushAllEditorSaves();
        } catch {
          saved = false;
        }

        if (saved) {
          go();
          return;
        }
        if (!hasPendingEditorSaves() && hasRejectedEditorSaves()) {
          // Everything else is saved; only refused edits remain. The editor decides.
          confirmDialogs.open({
            title: t('leaveWithRejectedEdits.title'),
            message: t('leaveWithRejectedEdits.message'),
            confirmLabel: t('leaveWithRejectedEdits.confirm'),
            cancelLabel: tActions('cancel'),
            closeLabel: tActions('close'),
            tone: 'danger',
            emphasis: 'strong',
            onConfirm: () => {
              for (const rejected of getRejectedEditorSaves()) {
                rejected.discard();
              }
              go();
            },
          });
          return;
        }
        showFailure(t('saveFailed'));
      })();
    },
    [router, showFailure, t, tActions],
  );

  return (
    <NavigationIntentProvider onNavigationIntent={onNavigationIntent}>
      {children}
      <BlockingAlertDialog
        opened={endedAccess !== null}
        onAction={leaveEndedAccess}
        loading={leaving}
        title={endedAccess === 'permission_revoked' ? tPermission('title') : tSession('title')}
        message={endedAccess === 'permission_revoked' ? tPermission('message') : tSession('message')}
        actionLabel={endedAccess === 'permission_revoked' ? tActions('confirm') : tActions('logIn')}
        level="warning"
        size="compact"
        backdrop={endedAccess === 'permission_revoked' ? 'obscure' : 'dim'}
      />
    </NavigationIntentProvider>
  );
}
