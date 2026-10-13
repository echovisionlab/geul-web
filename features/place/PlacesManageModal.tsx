'use client';
import { SupportingText } from '@/components/core/Typography';

import { LayoutStack as DsLayoutStack, LayoutInset as DsLayoutInset } from '@/components/core/Layout';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';

import { ContentModal } from '@/components/core/Modal';
import type { Coordinate } from '@/lib/types/common/coordinate';
import type { MapPlace } from '@/lib/types/map-place/model';
import { CreatePlaceModal, type CreatePlaceFormState } from './CreatePlaceModal';
import { MapPlaceSelect } from './MapPlaceSelect';
import { PlaceListRow, isPlaceAtCenter } from './PlaceListRow';

interface PlacesManageModalProps {
  opened: boolean;
  onClose: () => void;
  places: MapPlace[];
  center: Coordinate;
  onAddPlace: (placeId: string, placeData: { lat: number; lng: number }) => void;
  onRemovePlace: (placeId: string) => void;
  onCenterOnPlace: (place: MapPlace) => void;
  onCreatePlace: (data: CreatePlaceFormState) => void;
  isCreating?: boolean;
}

export function PlacesManageModal({
  opened,
  onClose,
  places,
  center,
  onAddPlace,
  onRemovePlace,
  onCenterOnPlace,
  onCreatePlace,
  isCreating = false,
}: PlacesManageModalProps) {
  const tModalActions = useTranslations('common.actions');
  const tCommonActions = useTranslations('common.actions');
  const tMapModal = useTranslations('editorCommon.mapPlacesModal');
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [createInitialName, setCreateInitialName] = useState('');

  const handleAddPlace = useCallback(
    (placeId: string | null, placeData: unknown) => {
      if (!placeId) {
        return;
      }
      const info = placeData as { lat: number; lng: number } | null;
      if (info) {
        onAddPlace(placeId, info);
      }
    },
    [onAddPlace],
  );

  const handleCreateNew = useCallback((searchTerm: string) => {
    setCreateInitialName(searchTerm);
    setCreateModalOpened(true);
  }, []);

  const handleCreateSubmit = useCallback(
    (data: CreatePlaceFormState) => {
      onCreatePlace(data);
      setCreateModalOpened(false);
    },
    [onCreatePlace],
  );

  return (
    <>
      <ContentModal
        opened={opened}
        onClose={onClose}
        title={tMapModal('title')}
        size="standard"
        closeLabel={tModalActions('close')}
      >
        <DsLayoutStack gap="md">
          {/* Search to add */}
          <MapPlaceSelect
            value={null}
            onChange={handleAddPlace}
            onCreateNew={handleCreateNew}
            placeholder={tMapModal('searchPlaceholder')}
          />

          {/* Places list */}
          {places.length === 0 ? (
            <DsLayoutInset block="md">
              <SupportingText tone="secondary" align="center">
                {tMapModal('emptyState')}
              </SupportingText>
            </DsLayoutInset>
          ) : (
            <DsLayoutStack gap="xs">
              {places.map((place) => (
                <PlaceListRow
                  key={place.id}
                  place={place}
                  isCenter={isPlaceAtCenter(place, center)}
                  labels={{
                    centerBadge: tMapModal('centerBadge'),
                    centered: tMapModal('centeredTitle'),
                    setAsCenter: tMapModal('setAsCenterTitle'),
                    remove: tCommonActions('remove'),
                  }}
                  onCenter={onCenterOnPlace}
                  onRemove={onRemovePlace}
                />
              ))}
            </DsLayoutStack>
          )}
        </DsLayoutStack>
      </ContentModal>

      <CreatePlaceModal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        onSubmit={handleCreateSubmit}
        isPending={isCreating}
        initialName={createInitialName}
      />
    </>
  );
}
