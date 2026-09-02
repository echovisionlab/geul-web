'use client';

import { useCallback, useState } from 'react';
import { IconFocus2, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Group, Modal, Stack, Text } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import { IconButton } from '@/components/core/IconButton';
import type { Coordinate } from '@/lib/types/common/coordinate';
import type { MapPlace } from '@/lib/types/map-place/model';
import { CreatePlaceModal, type CreatePlaceFormState } from './CreatePlaceModal';
import { MapPlaceSelect } from './MapPlaceSelect';

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

function isPlaceCenter(place: MapPlace, center: Coordinate): boolean {
  return Math.abs(place.coordinate.lat - center.lat) < 0.0001 && Math.abs(place.coordinate.lng - center.lng) < 0.0001;
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
      <Modal opened={opened} onClose={onClose} title={tMapModal('title')} size="md">
        <Stack gap="md">
          {/* Search to add */}
          <MapPlaceSelect
            value={null}
            onChange={handleAddPlace}
            onCreateNew={handleCreateNew}
            placeholder={tMapModal('searchPlaceholder')}
          />

          {/* Places list */}
          {places.length === 0 ? (
            <Text c="dimmed" size="sm" ta="center" py="md">
              {tMapModal('emptyState')}
            </Text>
          ) : (
            <Stack gap="xs">
              {places.map((place) => {
                const isCenter = isPlaceCenter(place, center);
                return (
                  <Group key={place.id} gap="xs" justify="space-between">
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Group gap={4}>
                        <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
                          {place.name}
                        </Text>
                        {isCenter && (
                          <LabelBadge size="xs" tone="accent">
                            {tMapModal('centerBadge')}
                          </LabelBadge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed" truncate>
                        {place.address}
                      </Text>
                    </Box>
                    <Group gap={4}>
                      <IconButton
                        emphasis={isCenter ? 'strong' : 'low'}
                        tone="accent"
                        size="sm"
                        onClick={() => onCenterOnPlace(place)}
                        label={isCenter ? tMapModal('centeredTitle') : tMapModal('setAsCenterTitle')}
                        title={isCenter ? tMapModal('centeredTitle') : tMapModal('setAsCenterTitle')}
                      >
                        <IconFocus2 size={14} />
                      </IconButton>
                      <IconButton
                        tone="danger"
                        emphasis="low"
                        size="sm"
                        onClick={() => onRemovePlace(place.id)}
                        label={tCommonActions('remove')}
                        title={tCommonActions('remove')}
                      >
                        <IconTrash size={14} />
                      </IconButton>
                    </Group>
                  </Group>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Modal>

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
