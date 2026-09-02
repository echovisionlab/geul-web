'use client';

import { useCallback, useMemo } from 'react';
import { IconArrowsMaximize, IconFocus2, IconMap, IconSettings, IconTrash, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Group, Modal, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Textarea } from '@/components/core/Input';
import { MapViewEmbedded } from '@/features/map/MapViewEmbedded';
import { PlacesManageModal } from '@/features/place/PlacesManageModal';
import type { MapRendererPlace } from '@/features/map/types';
import { MapLibreMapEditor } from '@/features/map/MapLibreMapEditor';
import { MapPlaceSelect } from '@/features/place/MapPlaceSelect';
import type { CreatePlaceFormState } from '@/features/place/CreatePlaceModal';
import { getMapPlacesByIdsAction } from '@/lib/actions/map-place';
import { listMapThemesAction, resolveMapThemeAction } from '@/lib/actions/map-theme';
import { useCreateMapPlaceForBlockAction } from '@/lib/contexts/MapPlaceActionContext';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import type { AddressComponents, MapPlace } from '@/lib/types/map-place/model';
import type { MapTheme } from '@/lib/types/map-theme/model';
import type { MapConfig, MapViewConfig, MapViewTheme } from '@/lib/types/map/model';
import { mapThemeToViewTheme } from '@/lib/utils/map-theme';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import { fromMapConfigUpdate, toMapConfig, type MapProps } from './schema';

interface MapSettingsFormProps {
  props: Partial<MapProps>;
  isExpanded?: boolean;
  updateSharedProps: (props: Record<string, unknown>) => void;
  updateLocalizedProps: (props: Record<string, unknown>) => void;
}

function parseMapPlaceIds(props: Partial<MapProps>): string[] {
  const ids = props.mapPlaceIds || '';
  return ids.split(',').filter((id) => id.trim());
}

function toEditorMapTheme(theme: MapTheme | undefined): MapViewTheme | null {
  return theme ? mapThemeToViewTheme(theme) : null;
}

function buildEditorMapViewConfig(
  config: MapConfig,
  places: MapPlace[],
  themes: MapTheme[] | undefined,
): MapViewConfig {
  const theme = config.themeId ? toEditorMapTheme(themes?.find((item) => item.id === config.themeId)) : null;

  return {
    center: config.center,
    zoom: config.zoom,
    minZoom: config.minZoom,
    maxZoom: config.maxZoom,
    pitch: config.pitch,
    bearing: config.bearing,
    aspectRatio: config.aspectRatio,
    previewWidth: config.previewWidth,
    draggable: config.draggable,
    zoomable: config.zoomable,
    rotatable: config.rotatable,
    tiltable: config.tiltable,
    pinClickable: config.pinClickable,
    autoRotate: config.autoRotate,
    autoRotateSpeed: config.autoRotateSpeed,
    showDirections: config.showDirections,
    show3DBuildings: config.show3DBuildings,
    preferredScheme: config.preferredScheme ?? 'auto',
    areaLabelsMode: config.areaLabelsMode,
    poiLabelsMode: config.poiLabelsMode,
    places: places.map((place) => ({
      id: place.id,
      name: place.name,
      address: place.address,
      lat: place.coordinate.lat,
      lng: place.coordinate.lng,
      addressComponents: place.addressComponents,
    })),
    theme,
  };
}

function MapSettingsForm({ props, isExpanded = true, updateSharedProps, updateLocalizedProps }: MapSettingsFormProps) {
  const t = useTranslations('pageEditor.mapEditor');
  const tCommonActions = useTranslations('common.actions');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tMapControls = useTranslations('mapControls');
  const createMapPlaceForBlockAction = useCreateMapPlaceForBlockAction();
  const queryClient = useQueryClient();

  // Modal states
  const [placesModalOpened, { open: openPlacesModal, close: closePlacesModal }] = useDisclosure(false);
  const [fullscreenOpened, { open: openFullscreen, close: closeFullscreen }] = useDisclosure(false);

  // Parse mapPlaceIds from comma-separated string
  const mapPlaceIds = useMemo(() => {
    return parseMapPlaceIds(props);
  }, [props.mapPlaceIds]);

  // Convert props to MapConfig
  const config = useMemo(() => toMapConfig(props), [props]);

  // Fetch all selected places
  const { data: selectedPlacesData } = useQuery({
    queryKey: ['mapPlace', 'byIds', mapPlaceIds],
    queryFn: () => getMapPlacesByIdsAction(mapPlaceIds),
    enabled: mapPlaceIds.length > 0,
  });

  // Fetch themes for Leva dropdown
  const { data: themesData } = useQuery({
    queryKey: ['mapThemes', 'list'],
    queryFn: () => listMapThemesAction(),
  });

  // Convert MapTheme[] to MapThemeListItem[] for MapLibreMapEditor
  const themes = useMemo(() => {
    if (!themesData) {
      return undefined;
    }
    return themesData.themes.map((t) => ({
      id: t.id,
      name: t.name,
    }));
  }, [themesData]);

  // Convert to MapPlace array (manually since action returns different shape)
  const places = useMemo<MapPlace[]>(() => {
    if (!selectedPlacesData) {
      return [];
    }
    return selectedPlacesData.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      coordinate: { lat: p.lat, lng: p.lng },
      googlePlaceId: p.googlePlaceId ?? null,
      addressComponents: null,
      imageFileId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }, [selectedPlacesData]);

  // Convert to MapRendererPlace format for MapLibreMapEditor
  const rendererPlaces = useMemo<MapRendererPlace[]>(() => {
    return places.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      lat: p.coordinate.lat,
      lng: p.coordinate.lng,
    }));
  }, [places]);

  // Update config.center when places change and no explicit center is set
  const effectiveConfig = useMemo<MapConfig>(() => {
    if (places.length > 0 && !props.centerLat && !props.centerLng) {
      return {
        ...config,
        center: places[0].coordinate,
      };
    }
    return config;
  }, [config, places, props.centerLat, props.centerLng]);

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
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['mapPlace', 'search'] });
      const newIds = [...mapPlaceIds, newPlace.id].join(',');
      updateSharedProps({
        mapPlaceIds: newIds,
        centerLat: String(newPlace.lat),
        centerLng: String(newPlace.lng),
      });
    },
  });

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

  const handleAddPlace = useCallback(
    (placeId: string, placeData: { lat: number; lng: number }) => {
      if (mapPlaceIds.includes(placeId)) {
        return;
      }

      const newIds = [...mapPlaceIds, placeId].join(',');
      const newProps: Partial<MapProps> = {
        mapPlaceIds: newIds,
      };

      if (mapPlaceIds.length === 0) {
        newProps.centerLat = String(placeData.lat);
        newProps.centerLng = String(placeData.lng);
      }

      updateSharedProps(newProps);
    },
    [mapPlaceIds, updateSharedProps],
  );

  const handleRemovePlace = useCallback(
    (placeId: string) => {
      const newIds = mapPlaceIds.filter((id) => id !== placeId).join(',');
      updateSharedProps({ mapPlaceIds: newIds });
    },
    [mapPlaceIds, updateSharedProps],
  );

  const handleCenterOnPlace = useCallback(
    (place: MapPlace) => {
      const propsUpdates = fromMapConfigUpdate({
        center: { lat: place.coordinate.lat, lng: place.coordinate.lng },
      });
      updateSharedProps(propsUpdates);
    },
    [updateSharedProps],
  );

  const handleConfigChange = useCallback(
    (updates: Partial<MapConfig>) => {
      const propsUpdates = fromMapConfigUpdate(updates);
      updateSharedProps(propsUpdates);
    },
    [updateSharedProps],
  );

  const handleSelectPlace = useCallback(
    (placeId: string | null, place: { lat: number; lng: number } | null) => {
      if (!placeId || !place) {
        return;
      }
      handleAddPlace(placeId, place);
    },
    [handleAddPlace],
  );

  return (
    <Box>
      {/* Header */}
      <Group gap="xs" mb="md" justify="space-between">
        <Group gap="xs">
          <IconMap size={18} />
          <Text size="sm" fw={500}>
            {t('title')}
          </Text>
          {places.length > 0 && <LabelBadge size="sm">{t('placeCount', { count: places.length })}</LabelBadge>}
        </Group>
        <Group gap={4}>
          <Button emphasis="low" size="sm" leftSection={<IconSettings size={14} />} onClick={openPlacesModal}>
            {tMapControls('managePlaces')}
          </Button>
          <IconButton emphasis="low" size="sm" onClick={openFullscreen} label={t('fullscreen')} title={t('fullscreen')}>
            <IconArrowsMaximize size={16} />
          </IconButton>
        </Group>
      </Group>

      <Stack gap="sm" mb="md">
        <MapPlaceSelect
          value={null}
          onChange={handleSelectPlace}
          placeholder={tCommonPlaceholders('searchPlaces')}
          label={tCommonEntities('mapPlaces')}
        />

        <Textarea
          label={tCommonLabels('caption')}
          placeholder={t('captionPlaceholder')}
          minRows={2}
          autosize
          value={props.caption || ''}
          onChange={(event) =>
            updateLocalizedProps({
              caption: event.currentTarget.value,
            })
          }
        />

        {places.length === 0 ? (
          <Text size="xs" c="dimmed">
            {t('emptyState')}
          </Text>
        ) : (
          <Stack gap="xs">
            {places.map((place) => {
              const isCenter =
                Math.abs(place.coordinate.lat - effectiveConfig.center.lat) < 0.0001 &&
                Math.abs(place.coordinate.lng - effectiveConfig.center.lng) < 0.0001;

              return (
                <Group key={place.id} gap="xs" justify="space-between">
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group gap={4}>
                      <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
                        {place.name}
                      </Text>
                      {isCenter ? (
                        <LabelBadge size="xs" tone="accent">
                          {t('centerBadge')}
                        </LabelBadge>
                      ) : null}
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
                      onClick={() => handleCenterOnPlace(place)}
                      label={isCenter ? t('centeredTitle') : t('setAsCenterTitle')}
                      title={isCenter ? t('centeredTitle') : t('setAsCenterTitle')}
                    >
                      <IconFocus2 size={14} />
                    </IconButton>
                    <IconButton
                      tone="danger"
                      emphasis="low"
                      size="sm"
                      onClick={() => handleRemovePlace(place.id)}
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

      {/* Map with Leva controls (floating) - hide when fullscreen modal is open */}
      {!fullscreenOpened && (
        <Box
          style={{
            borderRadius: 'var(--mantine-radius-md)',
            overflow: 'hidden',
          }}
        >
          <MapLibreMapEditor
            places={rendererPlaces}
            config={effectiveConfig}
            onConfigChange={handleConfigChange}
            resolveTheme={resolveMapThemeAction}
            onManagePlaces={openPlacesModal}
            themes={themes}
            height="300px"
            levaProps={{ floating: true, hidden: !isExpanded }}
          />
        </Box>
      )}

      {/* Fullscreen Map Modal */}
      <Modal
        opened={fullscreenOpened}
        onClose={closeFullscreen}
        fullScreen
        withCloseButton={false}
        padding={0}
        styles={{ body: { height: '100%' } }}
      >
        <Box h="100dvh">
          <MapLibreMapEditor
            places={rendererPlaces}
            config={effectiveConfig}
            onConfigChange={handleConfigChange}
            resolveTheme={resolveMapThemeAction}
            onManagePlaces={openPlacesModal}
            themes={themes}
            height="100%"
            levaProps={{ floating: true }}
          />
          <IconButton
            emphasis="strong"
            size="md"
            onClick={closeFullscreen}
            style={{ position: 'absolute', top: 16, left: 16, zIndex: 210 }}
            label={tCommonActions('close')}
            title={tCommonActions('close')}
          >
            <IconX size={18} />
          </IconButton>
        </Box>
      </Modal>

      {/* Places Management Modal */}
      <PlacesManageModal
        opened={placesModalOpened}
        onClose={closePlacesModal}
        places={places}
        center={effectiveConfig.center}
        onAddPlace={handleAddPlace}
        onRemovePlace={handleRemovePlace}
        onCenterOnPlace={handleCenterOnPlace}
        onCreatePlace={handleCreatePlace}
        isCreating={createPlace.isPending}
      />
    </Box>
  );
}

export function MapSettingsEditor({
  props,
  updateSharedProps,
  updateLocalizedProps,
}: BlockSettingsEditorProps<MapProps>) {
  return (
    <MapSettingsForm props={props} updateSharedProps={updateSharedProps} updateLocalizedProps={updateLocalizedProps} />
  );
}

export function MapEditor({ sectionId, props, isExpanded = true }: BlockEditorProps<MapProps>) {
  const { updateSection, updateLocalizedSectionProps } = usePageEditor();
  const updateSharedProps = useCallback(
    (nextProps: Record<string, unknown>) => {
      updateSection(sectionId, { props: nextProps });
    },
    [sectionId, updateSection],
  );
  const updateLocalizedProps = useCallback(
    (nextProps: Record<string, unknown>) => {
      updateLocalizedSectionProps(sectionId, nextProps);
    },
    [sectionId, updateLocalizedSectionProps],
  );

  return (
    <MapSettingsForm
      props={props}
      isExpanded={isExpanded}
      updateSharedProps={updateSharedProps}
      updateLocalizedProps={updateLocalizedProps}
    />
  );
}

export function MapCanvasPreview({ props }: BlockCanvasPreviewProps<MapProps>) {
  const t = useTranslations('pageEditor.mapEditor');
  const mapPlaceIds = useMemo(() => parseMapPlaceIds(props), [props]);
  const config = useMemo(() => toMapConfig(props), [props]);

  const { data: selectedPlacesData } = useQuery({
    queryKey: ['mapPlace', 'byIds', mapPlaceIds],
    queryFn: () => getMapPlacesByIdsAction(mapPlaceIds),
    enabled: mapPlaceIds.length > 0,
  });
  const { data: themesData } = useQuery({
    queryKey: ['mapThemes', 'list'],
    queryFn: () => listMapThemesAction(),
  });

  const places = useMemo<MapPlace[]>(() => {
    if (!selectedPlacesData) {
      return [];
    }
    return selectedPlacesData.map((place) => ({
      id: place.id,
      name: place.name,
      address: place.address,
      coordinate: { lat: place.lat, lng: place.lng },
      googlePlaceId: place.googlePlaceId ?? null,
      addressComponents: null,
      imageFileId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }, [selectedPlacesData]);

  const mapViewConfig = useMemo(
    () => buildEditorMapViewConfig(config, places, themesData?.themes),
    [config, places, themesData],
  );
  const rawProps = props as Record<string, unknown>;
  const blockAlignment =
    rawProps.textAlignment === 'left' || rawProps.textAlignment === 'center' || rawProps.textAlignment === 'right'
      ? rawProps.textAlignment
      : undefined;
  const caption = typeof props.caption === 'string' ? props.caption.trim() : '';

  if (places.length === 0) {
    return (
      <Box py="xl" ta="center">
        <Text c="dimmed" size="sm">
          {t('emptyState')}
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <MapViewEmbedded config={mapViewConfig} blockAlignment={blockAlignment} />
      {caption ? (
        <Text size="sm" c="dimmed" mt="xs" ta={blockAlignment}>
          {caption}
        </Text>
      ) : null}
    </Box>
  );
}
