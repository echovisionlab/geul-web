'use client';

import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { CreatePlaceModal, type CreatePlaceFormState } from '@/features/place/CreatePlaceModal';
import { MapPlaceSelect } from '@/features/place/MapPlaceSelect';
import { useCreateMapPlaceForBlockAction } from '@/lib/contexts/MapPlaceActionContext';
import type { AddressComponents } from '@/lib/types/map-place/model';

interface MapInsertModalProps {
  opened: boolean;
  onClose: () => void;
  onPlaceSelect: (placeId: string | null, placeData: { lat: number; lng: number } | null) => void;
}

export function MapInsertModal({ opened, onClose, onPlaceSelect }: MapInsertModalProps) {
  const t = useTranslations('mapInsertModal');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const createMapPlaceForBlockAction = useCreateMapPlaceForBlockAction();
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [createInitialName, setCreateInitialName] = useState('');

  const createPlace = useMutation({
    mutationFn: (data: {
      name: string;
      address: string;
      lat: number;
      lng: number;
      google_place_id?: string | null;
      address_components?: AddressComponents;
    }) => createMapPlaceForBlockAction(data),
    onSuccess: (newPlace) => {
      if (!newPlace) {
        notifications.show({
          color: 'red',
          message: t('notifications.createFailedPermissions'),
        });
        return;
      }
      onPlaceSelect(newPlace.id, { lat: newPlace.lat, lng: newPlace.lng });
      setCreateModalOpened(false);
    },
    onError: () => {
      notifications.show({
        color: 'red',
        message: t('notifications.createFailed'),
      });
    },
  });

  const handleCreateNew = useCallback((searchTerm: string) => {
    setCreateInitialName(searchTerm);
    setCreateModalOpened(true);
  }, []);

  const handleCreatePlace = useCallback(
    (data: CreatePlaceFormState) => {
      createPlace.mutate({
        name: data.name,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        google_place_id: data.googlePlaceId,
        address_components: data.addressComponents || undefined,
      });
    },
    [createPlace],
  );

  return (
    <>
      <Modal opened={opened} onClose={onClose} title={t('title')} size="sm">
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t('description')}
          </Text>
          <MapPlaceSelect
            value={null}
            onChange={onPlaceSelect}
            onCreateNew={handleCreateNew}
            showCreateButton
            placeholder={tCommonPlaceholders('searchPlaces')}
          />
        </Stack>
      </Modal>

      <CreatePlaceModal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        onSubmit={handleCreatePlace}
        isPending={createPlace.isPending}
        initialName={createInitialName}
      />
    </>
  );
}
