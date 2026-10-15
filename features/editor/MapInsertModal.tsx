'use client';
import { SupportingText } from '@/components/core/Typography';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { ContentModal } from '@/components/core/Modal';
import { notifications } from '@/components/core/Notification';
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
  const tModalActions = useTranslations('common.actions');
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
          tone: 'danger',
          message: t('notifications.createFailedPermissions'),
        });
        return;
      }
      onPlaceSelect(newPlace.id, { lat: newPlace.lat, lng: newPlace.lng });
      setCreateModalOpened(false);
    },
    onError: () => {
      notifications.show({
        tone: 'danger',
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
      <ContentModal
        opened={opened}
        onClose={onClose}
        title={t('title')}
        size="compact"
        closeLabel={tModalActions('close')}
      >
        <DsLayoutStack gap="md">
          <SupportingText tone="secondary">{t('description')}</SupportingText>
          <MapPlaceSelect
            value={null}
            onChange={onPlaceSelect}
            onCreateNew={handleCreateNew}
            showCreateButton
            placeholder={tCommonPlaceholders('searchPlaces')}
          />
        </DsLayoutStack>
      </ContentModal>

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
