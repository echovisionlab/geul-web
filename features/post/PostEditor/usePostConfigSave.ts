'use client';

import { saveFailureFromAction } from '@/lib/editor/save-failure';
import { Code } from '@connectrpc/connect';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { getPostConfigurationAction, updatePostAction } from '@/lib/actions/post';
import { useDebouncedPatch } from '@/lib/editor/useDebouncedPatch';
import { useAuthoritativeConfiguration } from '@/lib/editor/useAuthoritativeConfiguration';
import { publishEditorEntityChange, useEditorEntityChanges } from '@/lib/editor/editor-entity-changes';
import type { PostConfigurationSnapshot } from '@/lib/types/post/model';
import { isValidUuid } from '@/lib/utils/validation';
import type { PostConfigPatch } from './post-config-save';
import type { HocuspocusProvider } from '@hocuspocus/provider';

type PostConfigUpdate = Parameters<typeof updatePostAction>[1];

function hasLayoutIntent(patch: PostConfigPatch): boolean {
  return (
    patch.layoutContentHeight !== undefined || patch.layoutPageChrome !== undefined || patch.layoutFooter !== undefined
  );
}

function buildPostConfigUpdate(patch: PostConfigPatch, base: PostConfigurationSnapshot): PostConfigUpdate {
  const documentLayout = hasLayoutIntent(patch)
    ? {
        contentHeight: patch.layoutContentHeight ?? base.documentLayout.contentHeight,
        pageChrome: patch.layoutPageChrome ?? base.documentLayout.pageChrome,
        footer: patch.layoutFooter ?? base.documentLayout.footer,
      }
    : undefined;

  return {
    ...(patch.slug === undefined ? {} : { slug: patch.slug }),
    ...(patch.commentsEnabled === undefined ? {} : { commentsEnabled: patch.commentsEnabled }),
    ...(patch.mapPlaceId === undefined ? {} : { mapPlaceId: patch.mapPlaceId }),
    ...(documentLayout ? { documentLayout } : {}),
  };
}

function patchChangesConfiguration(patch: PostConfigPatch, configuration: PostConfigurationSnapshot): boolean {
  return (
    (patch.slug !== undefined && patch.slug !== (configuration.slug ?? '')) ||
    (patch.commentsEnabled !== undefined && patch.commentsEnabled !== configuration.commentsEnabled) ||
    (patch.mapPlaceId !== undefined && patch.mapPlaceId !== (configuration.mapPlaceId ?? '')) ||
    (patch.layoutContentHeight !== undefined &&
      patch.layoutContentHeight !== configuration.documentLayout.contentHeight) ||
    (patch.layoutPageChrome !== undefined && patch.layoutPageChrome !== configuration.documentLayout.pageChrome) ||
    (patch.layoutFooter !== undefined && patch.layoutFooter !== configuration.documentLayout.footer)
  );
}

type FlatPostConfiguration = PostConfigPatch & { configurationRevision: string };
function flatten(configuration: PostConfigurationSnapshot): FlatPostConfiguration {
  return {
    configurationRevision: configuration.configurationRevision,
    slug: configuration.slug ?? '',
    commentsEnabled: configuration.commentsEnabled,
    mapPlaceId: configuration.mapPlaceId ?? '',
    layoutContentHeight: configuration.documentLayout.contentHeight,
    layoutPageChrome: configuration.documentLayout.pageChrome,
    layoutFooter: configuration.documentLayout.footer,
  };
}
function expand(configuration: FlatPostConfiguration): PostConfigurationSnapshot {
  return {
    configurationRevision: configuration.configurationRevision,
    slug: configuration.slug || null,
    commentsEnabled: configuration.commentsEnabled!,
    mapPlaceId: configuration.mapPlaceId || null,
    documentLayout: {
      contentHeight: configuration.layoutContentHeight!,
      pageChrome: configuration.layoutPageChrome!,
      footer: configuration.layoutFooter!,
    },
  };
}

function configConflict(errorCode?: Code | string): boolean {
  return errorCode === Code.Aborted || errorCode === Code.FailedPrecondition;
}

/** Saves entity-wide Post settings with one bounded stale-revision merge attempt. */
export function usePostConfigSave(
  postId: string,
  initialConfiguration: PostConfigurationSnapshot,
  provider?: HocuspocusProvider | null,
) {
  const tCommonNotifications = useTranslations('common.notifications');
  const controller = useAuthoritativeConfiguration({
    document: `post:${postId}`,
    initialConfiguration: flatten(initialConfiguration),
  });
  const refresh = async () => {
    const read = controller.beginRead();
    const result = await getPostConfigurationAction(postId);
    if (!result.ok) {
      throw new Error(result.error);
    }
    if (isValidUuid(result.configuration.configurationRevision)) {
      controller.adoptRead(read, flatten(result.configuration));
    }
  };

  const mutation = useMutation({
    mutationFn: async (patch: PostConfigPatch) => {
      const write = controller.beginWrite(patch);
      const base = expand(controller.getCanonical());
      try {
        let result = await updatePostAction(
          postId,
          buildPostConfigUpdate(patch, base),
          base.configurationRevision,
          write.origin,
        );
        if (!result.ok && configConflict(result.errorCode)) {
          if (!controller.isActive()) {
            throw saveFailureFromAction(result);
          }
          const read = controller.beginRead();
          const latestResult = await getPostConfigurationAction(postId);
          if (!controller.isActive()) {
            throw new Error('The Post changed before its settings could be reconciled');
          }
          if (!latestResult.ok) {
            throw saveFailureFromAction(latestResult);
          }
          const latest = latestResult.configuration;
          if (!isValidUuid(latest.configurationRevision)) {
            throw new Error(tCommonNotifications('updateFailed'));
          }
          controller.adoptRead(read, flatten(latest));
          write.rebase();
          if (!patchChangesConfiguration(patch, latest)) {
            write.acknowledge(flatten(latest), { full: true });
            return;
          }
          result = await updatePostAction(
            postId,
            buildPostConfigUpdate(patch, latest),
            latest.configurationRevision,
            write.origin,
          );
        }
        if (!result.ok) {
          throw saveFailureFromAction(result);
        }
        const configuration = result.configuration;
        if (!configuration || !isValidUuid(configuration.configurationRevision)) {
          throw new Error(tCommonNotifications('updateFailed'));
        }
        const adopted = write.acknowledge(flatten(configuration), { full: true });
        publishEditorEntityChange(`post:${postId}`, write.origin);
        if (!adopted && controller.isActive()) {
          // The write already committed. A failed follow-up read must not requeue its old intent.
          await refresh().catch((error: unknown) => {
            notifications.show({
              message: error instanceof Error ? error.message : tCommonNotifications('updateFailed'),
              tone: 'danger',
            });
          });
        }
      } catch (error) {
        write.fail();
        throw error;
      }
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('updateFailed'),
        tone: 'danger',
      });
    },
  });

  const save = useDebouncedPatch<PostConfigPatch>({
    document: `post:${postId}`,
    recoveryScope: `post:${postId}:configuration`,
    recoveryKey: 'post-configuration',
    scope: controller,
    delay: 500,
    retry: true,
    write: (patch) => mutation.mutateAsync(patch),
  });

  useEditorEntityChanges(
    `post:${postId}`,
    () => {
      void refresh().catch((error: unknown) => {
        notifications.show({
          message: error instanceof Error ? error.message : tCommonNotifications('updateFailed'),
          tone: 'danger',
        });
      });
    },
    provider,
    undefined,
    controller.captureOwnChange,
  );

  const enqueue = (patch: PostConfigPatch) => {
    controller.edit(patch);
    save(patch);
  };

  return Object.assign(enqueue, {
    flush: save.flush,
    cancel: save.cancel,
    hasPending: save.hasPending,
    getPendingPatch: save.getPendingPatch,
    isPending: mutation.isPending,
    // Configuration conflicts are retried in-place; only source/body revision
    // conflicts use the blocking reload dialog.
    conflict: false,
    configurationRevision: controller.getCanonical().configurationRevision,
    configuration: expand(controller.getConfiguration()),
  });
}
