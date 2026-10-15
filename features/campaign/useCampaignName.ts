'use client';

import { saveFailureFromAction } from '@/lib/editor/save-failure';
import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@/components/core/Notification';
import { updateCampaignNameAction } from '@/lib/actions/campaign';
import type { CampaignFields } from '@/lib/collab/schemas/campaign-fields.schema';
import type { AuthoritativeConfiguration } from '@/lib/editor/useAuthoritativeConfiguration';
import { useDebouncedPatch } from '@/lib/editor/useDebouncedPatch';
import { publishEditorEntityChange } from '@/lib/editor/editor-entity-changes';

const TITLE_DEBOUNCE_MS = 500;

export type CampaignEditorConfiguration = CampaignFields & { name: string };

interface Options {
  campaignId: string;
  configuration: AuthoritativeConfiguration<CampaignEditorConfiguration>;
  refetchConfiguration: () => Promise<void>;
  editable: boolean;
}

export function useCampaignName({ campaignId, configuration, refetchConfiguration, editable }: Options) {
  const queryClient = useQueryClient();
  const updateName = useMutation({
    mutationFn: (request: { name: string; origin: string }) =>
      updateCampaignNameAction(campaignId, request.name, request.origin),
  });
  const persistDebounced = useDebouncedPatch({
    document: `campaign:${campaignId}`,
    scope: campaignId,
    // Lets a later page (after sign-in) restore an unsaved name from this tab's backup.
    recoveryKey: 'campaign-name',
    delay: TITLE_DEBOUNCE_MS,
    write: async (patch: { name: string }) => {
      const write = configuration.beginWrite(patch);
      try {
        const result = await updateName.mutateAsync({ name: patch.name.trim(), origin: write.origin });
        if (result.error) {
          throw saveFailureFromAction({ error: result.error, errorCode: result.errorCode });
        }
        const adopted = write.acknowledge(
          { name: result.name ?? patch.name.trim() },
          { authoritative: result.name !== undefined },
        );
        publishEditorEntityChange(`campaign:${campaignId}`, write.origin);
        void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
        if (!adopted || result.name === undefined) {
          // A failed refresh must not retry an already committed name write.
          await refetchConfiguration().catch(() => undefined);
        }
      } catch (error) {
        write.fail();
        notifications.show({ message: error instanceof Error ? error.message : String(error), tone: 'danger' });
        throw error;
      }
    },
  });
  const changeName = useCallback(
    (value: string) => {
      if (!editable) {
        return;
      }
      configuration.setDraft('name', value);
      persistDebounced({ name: value });
    },
    [configuration, editable, persistDebounced],
  );
  return { name: configuration.getConfiguration().name, changeName, pending: updateName.isPending };
}
