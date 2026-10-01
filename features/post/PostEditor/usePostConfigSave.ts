'use client';

import { Code } from '@connectrpc/connect';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { updatePostAction } from '@/lib/actions/post';
import { useDebouncedPatch } from '@/lib/editor/useDebouncedPatch';
import { isValidUuid } from '@/lib/utils/validation';
import type { PostConfigPatch } from './post-config-save';

class PostConfigurationConflictError extends Error {}

interface ResidentRevision {
  postId: string;
  configurationRevision: string;
  conflicted: boolean;
  generation: number;
}

/** One acknowledged, latest-field-wins queue for entity-wide Post configuration. */
export function usePostConfigSave(postId: string, initialConfigurationRevision: string) {
  const tCommonNotifications = useTranslations('common.notifications');
  const residentRevision = useRef<ResidentRevision>({
    postId,
    configurationRevision: initialConfigurationRevision,
    conflicted: false,
    generation: 0,
  });

  // Each entity has one resident revision for this mounted editor. An RSC prop
  // refresh cannot silently replace it; a different Post gets its own token.
  if (residentRevision.current.postId !== postId) {
    residentRevision.current = {
      postId,
      configurationRevision: initialConfigurationRevision,
      conflicted: false,
      generation: residentRevision.current.generation + 1,
    };
  }

  const [conflictIdentity, setConflictIdentity] = useState<{ postId: string; generation: number } | null>(null);
  const mutation = useMutation({
    mutationFn: async (request: {
      targetPostId: string;
      residentGeneration: number;
      patch: PostConfigPatch;
      expectedConfigurationRevision: string;
    }) => {
      const result = await updatePostAction(request.targetPostId, request.patch, request.expectedConfigurationRevision);
      const resident = residentRevision.current;
      if (
        resident.postId !== request.targetPostId ||
        resident.generation !== request.residentGeneration ||
        resident.configurationRevision !== request.expectedConfigurationRevision
      ) {
        return;
      }

      if (!result.ok) {
        if (result.errorCode === Code.Aborted || result.errorCode === Code.FailedPrecondition) {
          resident.conflicted = true;
          setConflictIdentity({ postId: request.targetPostId, generation: resident.generation });
          throw new PostConfigurationConflictError(result.error);
        }
        throw new Error(result.error);
      }

      if (!isValidUuid(result.configurationRevision)) {
        throw new Error(tCommonNotifications('updateFailed'));
      }
      resident.configurationRevision = result.configurationRevision;
    },
    onError: (error) => {
      if (error instanceof PostConfigurationConflictError) {
        return;
      }
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('updateFailed'),
        color: 'red',
      });
    },
  });

  const queuePostId = postId;
  const queueResident = residentRevision.current;
  const save = useDebouncedPatch<PostConfigPatch>({
    document: `post:${postId}`,
    recoveryScope: `post:${postId}:configuration`,
    scope: postId,
    delay: 500,
    write: (patch) => {
      const resident = residentRevision.current;
      if (resident !== queueResident || resident.postId !== queuePostId) {
        throw new Error('The Post changed before its settings were saved');
      }
      if (resident.conflicted) {
        throw new PostConfigurationConflictError('Reload this Post before saving more settings');
      }
      return mutation.mutateAsync({
        targetPostId: queuePostId,
        residentGeneration: queueResident.generation,
        patch,
        expectedConfigurationRevision: resident.configurationRevision,
      });
    },
  });

  return Object.assign(save, {
    isPending: mutation.isPending,
    conflict:
      (conflictIdentity?.postId === postId && conflictIdentity.generation === residentRevision.current.generation) ||
      residentRevision.current.conflicted,
    configurationRevision: residentRevision.current.configurationRevision,
  });
}
