'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { IconChevronDown, IconChevronUp, IconTrash } from '@tabler/icons-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useTranslations } from 'next-intl';
import { Box, Divider, Group, Modal, Paper, ScrollArea, Stack, Text } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { Button } from '@/components/core/Button';
import { Drawer } from '@/components/core/Drawer';
import { EditorHeader } from '@/features/authoring/EditorHeader';
import { BaseMap } from '@/features/map/BaseMap';
import { Marker } from '@/features/map/Marker';
import { MapProvider } from '@/features/map/MapProvider';
import { PlacesAutocomplete } from '@/features/place/PlacesAutocomplete';
import type { GooglePlaceSearchResult } from '@/lib/types/location/model';
import type { PlaceEditorFormState } from '@/lib/types/map-place/model';
import { parseAddressComponents, parseGeocoderAddressComponents } from '@/lib/utils/address';
import { PlaceDetailForm } from './PlaceDetailForm';
import styles from './PlaceEditor.module.css';

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

interface PlaceEditorProps {
  /** Initial data for editing existing place */
  initialData?: PlaceEditorFormState;
  /** Submit handler */
  onSubmit: (data: PlaceEditorFormState) => void;
  /** Delete handler (only for edit mode) */
  onDelete?: () => void;
  /** Back button handler */
  onBack: () => void;
  /** Submit button label */
  submitLabel?: string;
  /** Page title */
  title?: string;
  /** Whether submit is in progress */
  isSubmitting?: boolean;
  /** Whether delete is in progress */
  isDeleting?: boolean;
  /** Optional metadata panel content */
  metadata?: ReactNode;
}

function PlaceEditorContent({
  initialData,
  onSubmit,
  onDelete,
  onBack,
  submitLabel,
  title,
  isSubmitting,
  isDeleting,
  metadata,
}: PlaceEditorProps) {
  const t = useTranslations('placeEditor');
  const tCommonActions = useTranslations('common.actions');
  const tCommonMessages = useTranslations('common.messages');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const geocodingLib = useMapsLibrary('geocoding');
  const placesLib = useMapsLibrary('places');
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [formState, setFormState] = useState<PlaceEditorFormState>(
    initialData ?? {
      name: '',
      address: '',
      lat: DEFAULT_CENTER.lat,
      lng: DEFAULT_CENTER.lng,
      googlePlaceId: null,
      addressComponents: null,
    },
  );
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [drawerOpened, { toggle: toggleDrawer }] = useDisclosure(true);

  // Sync with initialData when it changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      setFormState(initialData);
    }
  }, [initialData]);

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      setFormState((prev) => ({ ...prev, lat, lng, googlePlaceId: null }));

      if (geocodingLib) {
        setGeocodingLoading(true);
        try {
          const geocoder = new geocodingLib.Geocoder();
          const response = await geocoder.geocode({ location: { lat, lng } });
          if (response.results?.[0]) {
            const result = response.results[0];
            setFormState((prev) => ({
              ...prev,
              address: result.formatted_address,
              addressComponents: parseGeocoderAddressComponents(result.address_components),
            }));
          }
        } catch {
          // Ignore
        } finally {
          setGeocodingLoading(false);
        }
      }
    },
    [geocodingLib],
  );

  const handlePoiClick = useCallback(
    async (placeId: string, lat: number, lng: number) => {
      setFormState((prev) => ({ ...prev, lat, lng, googlePlaceId: placeId }));

      if (placesLib) {
        setGeocodingLoading(true);
        try {
          const place = new placesLib.Place({ id: placeId });
          await place.fetchFields({
            fields: ['displayName', 'formattedAddress', 'addressComponents'],
          });
          setFormState((prev) => ({
            ...prev,
            name: place.displayName ?? prev.name,
            address: place.formattedAddress ?? prev.address,
            googlePlaceId: placeId,
            addressComponents: place.addressComponents
              ? parseAddressComponents(place.addressComponents)
              : prev.addressComponents,
          }));
        } catch {
          // Fallback to reverse geocoding
          if (geocodingLib) {
            try {
              const geocoder = new geocodingLib.Geocoder();
              const response = await geocoder.geocode({ location: { lat, lng } });
              if (response.results?.[0]) {
                const result = response.results[0];
                setFormState((prev) => ({
                  ...prev,
                  address: result.formatted_address,
                  addressComponents: parseGeocoderAddressComponents(result.address_components),
                }));
              }
            } catch {
              // Ignore
            }
          }
        } finally {
          setGeocodingLoading(false);
        }
      }
    },
    [placesLib, geocodingLib],
  );

  const handlePlaceSelect = useCallback((result: GooglePlaceSearchResult) => {
    setFormState((prev) => ({
      ...prev,
      name: result.name ?? prev.name,
      address: result.address ?? prev.address,
      lat: result.coordinate.lat,
      lng: result.coordinate.lng,
      googlePlaceId: result.placeId,
      addressComponents: result.addressComponents ?? prev.addressComponents,
    }));
  }, []);

  const handleSubmit = useCallback(() => {
    onSubmit(formState);
  }, [formState, onSubmit]);

  const handleDelete = useCallback(() => {
    onDelete?.();
  }, [onDelete]);

  const isFormValid = Boolean(formState.name.trim() && formState.address.trim());
  const hasLocation = formState.lat !== 0 || formState.lng !== 0;
  const resolvedSubmitLabel = submitLabel ?? tCommonActions('save');
  const resolvedTitle = title ?? t('title');
  const headerTitle = formState.name || resolvedTitle;

  return (
    <>
      <Box className={styles.container}>
        <Box px="md" py="xs" style={{ flexShrink: 0 }}>
          <EditorHeader
            title={headerTitle}
            isConnected
            isSynced
            hideConnectionStatus
            hideStatus
            onBack={onBack}
            backTooltip={tCommonActions('back')}
            actionItems={[
              ...(!isMobile && onDelete
                ? [
                    {
                      key: 'delete',
                      label: tCommonActions('delete'),
                      icon: <IconTrash size={14} />,
                      tone: 'danger' as const,
                      emphasis: 'low' as const,
                      onClick: openDeleteModal,
                    },
                  ]
                : []),
              {
                key: 'save',
                label: resolvedSubmitLabel,
                disabled: !isFormValid,
                loading: isSubmitting,
                onClick: handleSubmit,
              },
            ]}
          />
        </Box>

        <Divider style={{ flexShrink: 0 }} />

        <Box className={styles.content}>
          <Box className={styles.mapContainer}>
            {isMobile && (
              <Box className={styles.floatingSearch}>
                <PlacesAutocomplete
                  onPlaceSelect={handlePlaceSelect}
                  placeholder={tCommonPlaceholders('searchPlaces')}
                />
              </Box>
            )}

            <BaseMap
              center={{ lat: formState.lat, lng: formState.lng }}
              zoom={hasLocation ? 15 : 12}
              panTo={hasLocation ? { lat: formState.lat, lng: formState.lng } : null}
              gestureHandling="greedy"
              clickableIcons
              onClick={handleMapClick}
              onLongPress={handleMapClick}
              onPoiClick={handlePoiClick}
            >
              {hasLocation && <Marker position={{ lat: formState.lat, lng: formState.lng }} />}
            </BaseMap>

            {isMobile && (
              <Box className={styles.bottomBar} onClick={toggleDrawer}>
                <Group justify="space-between" wrap="nowrap">
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={500} lineClamp={1}>
                      {formState.name || formState.address || t('selectLocation')}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {formState.lat.toFixed(6)}, {formState.lng.toFixed(6)}
                    </Text>
                  </Box>
                  {drawerOpened ? <IconChevronDown size={20} /> : <IconChevronUp size={20} />}
                </Group>
              </Box>
            )}
          </Box>

          {!isMobile && (
            <Paper className={styles.formPanel}>
              <Box p="md">
                <PlacesAutocomplete
                  onPlaceSelect={handlePlaceSelect}
                  placeholder={tCommonPlaceholders('searchPlaces')}
                />
              </Box>
              <Divider />
              <ScrollArea style={{ flex: 1 }} p="md">
                <PlaceDetailForm formState={formState} onFormChange={setFormState} loading={geocodingLoading} />
              </ScrollArea>
              {metadata ? (
                <>
                  <Divider />
                  <Box p="md">{metadata}</Box>
                </>
              ) : null}
            </Paper>
          )}
        </Box>
      </Box>

      {isMobile && (
        <Drawer
          opened={drawerOpened}
          onClose={toggleDrawer}
          placement="bottom"
          size="compact"
          closeLabel={tCommonActions('close')}
          title={
            <Group justify="space-between" w="100%">
              <Text fw={500}>{t('placeDetails')}</Text>
              {onDelete && (
                <Button
                  tone="danger"
                  emphasis="low"
                  size="xs"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => {
                    toggleDrawer();
                    openDeleteModal();
                  }}
                >
                  {tCommonActions('delete')}
                </Button>
              )}
            </Group>
          }
        >
          <ScrollArea h="calc(60dvh - 80px)" offsetScrollbars>
            <PlaceDetailForm formState={formState} onFormChange={setFormState} loading={geocodingLoading} />
            {metadata ? (
              <>
                <Divider my="md" />
                <Box pb="md">{metadata}</Box>
              </>
            ) : null}
          </ScrollArea>
        </Drawer>
      )}

      {onDelete && (
        <Modal opened={deleteModalOpened} onClose={closeDeleteModal} title={t('deleteModal.title')}>
          <Stack>
            <Text>
              {tCommonMessages.rich('confirmDeleteNamedRich', {
                name: formState.name,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </Text>
            <Group justify="flex-end">
              <Button emphasis="low" onClick={closeDeleteModal}>
                {tCommonActions('cancel')}
              </Button>
              <Button tone="danger" onClick={handleDelete} loading={isDeleting}>
                {tCommonActions('delete')}
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}
    </>
  );
}

export function PlaceEditor(props: PlaceEditorProps) {
  return (
    <MapProvider>
      <PlaceEditorContent {...props} />
    </MapProvider>
  );
}
