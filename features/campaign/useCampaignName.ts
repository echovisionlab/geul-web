'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { updateCampaignNameAction } from '@/lib/actions/campaign';

const TITLE_DEBOUNCE_MS = 500;

interface CampaignNameSource {
  name: string;
  subject?: string;
}

interface Options {
  campaignId: string;
  campaign: CampaignNameSource | null | undefined;
  editable: boolean;
}

export function useCampaignName({ campaignId, campaign, editable }: Options) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  useEffect(() => {
    if (campaign) {
      setName(campaign.name || campaign.subject || '');
    }
  }, [campaign]);

  const updateName = useMutation({
    mutationFn: (nextName: string) => updateCampaignNameAction(campaignId, nextName),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        setName(campaign?.name ?? '');
        void queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] });
        void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
        return;
      }

      if (result.name !== undefined) {
        setName(result.name);
        queryClient.setQueryData<CampaignNameSource | null | undefined>(['campaigns', campaignId], (current) =>
          current ? { ...current, name: result.name! } : current,
        );
        void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      }
    },
    onError: (error) => {
      notifications.show({ message: error.message, color: 'red' });
      setName(campaign?.name ?? '');
      void queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] });
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  const persistDebounced = useDebouncedCallback(
    (value: string) => {
      const normalizedName = value.trim();
      if (!editable || normalizedName === '' || normalizedName === (campaign?.name.trim() ?? '')) {
        return;
      }
      updateName.mutate(normalizedName);
    },
    { delay: TITLE_DEBOUNCE_MS, flushOnUnmount: true },
  );

  const changeName = useCallback(
    (value: string) => {
      if (!editable) {
        return;
      }
      setName(value);
      persistDebounced(value);
    },
    [editable, persistDebounced],
  );

  return { name, changeName, pending: updateName.isPending };
}
