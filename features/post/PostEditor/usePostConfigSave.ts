'use client';

import { Code } from '@connectrpc/connect';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { getPostConfigurationAction, updatePostAction } from '@/lib/actions/post';
import { useDebouncedPatch } from '@/lib/editor/useDebouncedPatch';
import { publishEditorEntityChange, useEditorEntityChanges } from '@/lib/editor/editor-entity-changes';
import type { PostConfigurationSnapshot } from '@/lib/types/post/model';
import { isValidUuid } from '@/lib/utils/validation';
import type { PostConfigPatch } from './post-config-save';
import type { HocuspocusProvider } from '@hocuspocus/provider';

interface ResidentConfiguration {
  postId: string;
  configuration: PostConfigurationSnapshot;
  generation: number;
  observationGeneration: number;
}

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

function overlayPendingPatch(
  configuration: PostConfigurationSnapshot,
  patch: PostConfigPatch | null,
): PostConfigurationSnapshot {
  if (!patch) {
    return configuration;
  }
  return {
    ...configuration,
    ...(patch.slug === undefined ? {} : { slug: patch.slug || null }),
    ...(patch.commentsEnabled === undefined ? {} : { commentsEnabled: patch.commentsEnabled }),
    ...(patch.mapPlaceId === undefined ? {} : { mapPlaceId: patch.mapPlaceId || null }),
    documentLayout: {
      ...configuration.documentLayout,
      ...(patch.layoutContentHeight === undefined ? {} : { contentHeight: patch.layoutContentHeight }),
      ...(patch.layoutPageChrome === undefined ? {} : { pageChrome: patch.layoutPageChrome }),
      ...(patch.layoutFooter === undefined ? {} : { footer: patch.layoutFooter }),
    },
  };
}

function mergePostConfigPatches(
  earlier: PostConfigPatch | null,
  later: PostConfigPatch | null,
): PostConfigPatch | null {
  if (!earlier) {
    return later;
  }
  if (!later) {
    return earlier;
  }
  return { ...earlier, ...later };
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
  const [, setSnapshotVersion] = useState(0);
  const pendingPatchReader = useRef<() => PostConfigPatch | null>(() => null);
  const adoptSnapshot = useRef<(snapshot: PostConfigurationSnapshot, preserve?: PostConfigPatch | null) => void>(
    () => {},
  );
  const localIntentSequence = useRef(0);
  const latestLocalIntent = useRef(new Map<keyof PostConfigPatch, { sequence: number; value: unknown }>());
  const resident = useRef<ResidentConfiguration>({
    postId,
    configuration: initialConfiguration,
    generation: 0,
    observationGeneration: 0,
  });

  if (resident.current.postId !== postId) {
    resident.current = {
      postId,
      configuration: initialConfiguration,
      generation: resident.current.generation + 1,
      observationGeneration: 0,
    };
  }

  const mutation = useMutation({
    mutationFn: async (request: {
      targetPostId: string;
      residentGeneration: number;
      intentSequence: number;
      patch: PostConfigPatch;
      baseConfiguration: PostConfigurationSnapshot;
    }) => {
      const isCurrent = () =>
        resident.current.postId === request.targetPostId && resident.current.generation === request.residentGeneration;

      let observationGeneration = resident.current.observationGeneration;
      let result = await updatePostAction(
        request.targetPostId,
        buildPostConfigUpdate(request.patch, request.baseConfiguration),
        request.baseConfiguration.configurationRevision,
      );

      if (!isCurrent()) {
        if (!result.ok) {
          throw new Error(result.error);
        }
        publishEditorEntityChange(`post:${request.targetPostId}`);
        return;
      }

      if (!result.ok && configConflict(result.errorCode)) {
        const latestResult = await getPostConfigurationAction(request.targetPostId);
        if (!isCurrent()) {
          throw new Error('The Post changed before its settings could be reconciled');
        }
        if (!latestResult.ok) {
          throw new Error(latestResult.error);
        }

        const latest = latestResult.configuration;
        if (!isValidUuid(latest.configurationRevision)) {
          throw new Error(tCommonNotifications('updateFailed'));
        }

        adoptSnapshot.current(
          latest,
          mergePostConfigPatches(request.patch, getLocalIntentAfter(request.intentSequence)),
        );
        observationGeneration = resident.current.observationGeneration;
        if (!patchChangesConfiguration(request.patch, latest)) {
          return;
        }

        result = await updatePostAction(
          request.targetPostId,
          buildPostConfigUpdate(request.patch, latest),
          latest.configurationRevision,
        );
        if (!isCurrent()) {
          if (!result.ok) {
            throw new Error(result.error);
          }
          publishEditorEntityChange(`post:${request.targetPostId}`);
          return;
        }
        if (!result.ok) {
          // Keep the sparse intent in the editor queue. The queue can retry with
          // backoff; a second conflict must not turn into a reload gate.
          throw new Error(result.error);
        }
      } else if (!result.ok) {
        throw new Error(result.error);
      }

      const configuration = result.configuration;
      if (!configuration || !isValidUuid(configuration.configurationRevision)) {
        throw new Error(tCommonNotifications('updateFailed'));
      }
      publishEditorEntityChange(`post:${request.targetPostId}`);
      if (isCurrent()) {
        if (resident.current.observationGeneration === observationGeneration) {
          adoptSnapshot.current(configuration, getLocalIntentAfter(request.intentSequence));
        } else {
          // A peer snapshot arrived while this request was in flight. Read once
          // more so an older acknowledgement cannot move the resident revision back.
          const latestResult = await getPostConfigurationAction(request.targetPostId);
          if (isCurrent() && latestResult.ok && isValidUuid(latestResult.configuration.configurationRevision)) {
            adoptSnapshot.current(latestResult.configuration, getLocalIntentAfter(request.intentSequence));
          }
        }
      }
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('updateFailed'),
        color: 'red',
      });
    },
  });

  const queuePostId = postId;
  const queueResident = resident.current;
  const save = useDebouncedPatch<PostConfigPatch>({
    document: `post:${postId}`,
    recoveryScope: `post:${postId}:configuration`,
    recoveryKey: 'post-configuration',
    scope: postId,
    delay: 500,
    retry: true,
    write: (patch) => {
      const current = resident.current;
      if (current !== queueResident || current.postId !== queuePostId) {
        throw new Error('The Post changed before its settings were saved');
      }
      return mutation.mutateAsync({
        targetPostId: queuePostId,
        residentGeneration: queueResident.generation,
        intentSequence: localIntentSequence.current,
        patch,
        baseConfiguration: current.configuration,
      });
    },
  });

  pendingPatchReader.current = save.getPendingPatch;
  const getLocalIntentAfter = (sequence: number): PostConfigPatch | null => {
    const patch: PostConfigPatch = {};
    for (const [field, intent] of latestLocalIntent.current) {
      if (intent.sequence > sequence) {
        (patch as Record<string, unknown>)[field] = intent.value;
      }
    }
    return Object.keys(patch).length > 0 ? patch : null;
  };

  adoptSnapshot.current = (snapshot, preserve) => {
    const current = resident.current;
    current.configuration = overlayPendingPatch(
      snapshot,
      preserve === undefined ? pendingPatchReader.current() : preserve,
    );
    current.observationGeneration += 1;
    setSnapshotVersion((version) => version + 1);
  };

  useEditorEntityChanges(
    `post:${postId}`,
    () => {
      void (async () => {
        const result = await getPostConfigurationAction(postId);
        if (!result.ok) {
          notifications.show({ message: result.error, color: 'red' });
          return;
        }
        if (isValidUuid(result.configuration.configurationRevision) && resident.current.postId === postId) {
          adoptSnapshot.current(result.configuration);
        }
      })().catch((error: unknown) => {
        notifications.show({
          message: error instanceof Error ? error.message : tCommonNotifications('updateFailed'),
          color: 'red',
        });
      });
    },
    provider,
  );

  const enqueue = (patch: PostConfigPatch) => {
    const sequence = ++localIntentSequence.current;
    for (const [field, value] of Object.entries(patch) as [keyof PostConfigPatch, unknown][]) {
      latestLocalIntent.current.set(field, { sequence, value });
    }
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
    configurationRevision: resident.current.configuration.configurationRevision,
    configuration: resident.current.configuration,
  });
}
