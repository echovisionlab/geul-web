'use client';
import { breakpointQuery } from '@/components/core/Layout/breakpoints';

import { ConfirmationDialog } from '@/features/confirmation';
import {
  LayoutInset as DsLayoutInset,
  LayoutInline as DsLayoutInline,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';

import { SectionCard as DsSectionCard } from '@/components/core/Section';
import { Text as DsText } from '@/components/core/Typography';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { IconChevronDown, IconChevronUp, IconTrash } from '@tabler/icons-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useTranslations } from 'next-intl';

import { Separator as Divider, ScrollArea } from '@/components/core/Display';
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
  /** Render manual place fields without requesting the external map service. */
  localOnly?: boolean;
  /** Initial data for editing existing place */
  initialData?: PlaceEditorFormState;
  /** Submit handler */
  onSubmit: (updates: Partial<PlaceEditorFormState>) => Promise<boolean>;
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
  localOnly = false,
  geocodingLib,
  placesLib,
}: PlaceEditorProps & {
  geocodingLib: google.maps.GeocodingLibrary | null;
  placesLib: google.maps.PlacesLibrary | null;
}) {
  const tModalActions = useTranslations('common.actions');
  const t = useTranslations('placeEditor');
  const tCommonActions = useTranslations('common.actions');
  const tCommonMessages = useTranslations('common.messages');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const isMobile = useMediaQuery(breakpointQuery('sm'));

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
  const baselineRef = useRef(clonePlaceEditorFormState(formState));
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [drawerOpened, { toggle: toggleDrawer }] = useDisclosure(true);

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

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    const submittedState = clonePlaceEditorFormState(formState);
    const updates = diffPlaceEditorFormState(baselineRef.current, submittedState);
    if (Object.keys(updates).length === 0) {
      return;
    }

    if (await onSubmit(updates)) {
      // Advance the baseline to the submitted values without replacing the draft.
      // Inputs changed while the request was pending remain dirty for the next save.
      baselineRef.current = submittedState;
    }
  }, [formState, isSubmitting, onSubmit]);

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
      <div className={styles.container}>
        <DsSectionCard padding="none" appearance="surface" stretch layout="stack" clip>
          <DsLayoutInset inline="md" block="xs">
            <DsLayoutInset shrink={false} space="none">
              <EditorHeader
                title={headerTitle}
                isConnected
                isSynced
                hideConnectionStatus
                hideStatus
                onBack={onBack}
                backTooltip={tCommonActions('back')}
                actionItems={[
                  ...((localOnly || !isMobile) && onDelete
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
                    disabled: !isFormValid || isSubmitting,
                    loading: isSubmitting,
                    onClick: handleSubmit,
                  },
                ]}
              />
            </DsLayoutInset>
          </DsLayoutInset>

          <Divider />

          {localOnly ? (
            <ScrollArea grow inset="md">
              <PlaceDetailForm formState={formState} onFormChange={setFormState} />
              {metadata ? <DsLayoutInset block="md">{metadata}</DsLayoutInset> : null}
            </ScrollArea>
          ) : (
            <DsLayoutInline flexible fill="both" gap="none" wrap="nowrap" clip>
              <DsLayoutInset flexible fill="both" space="none" clip>
                <div className={styles.mapContainer}>
                  {isMobile && (
                    <div className={styles.floatingSearch}>
                      <PlacesAutocomplete
                        onPlaceSelect={handlePlaceSelect}
                        placeholder={tCommonPlaceholders('searchPlaces')}
                      />
                    </div>
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
                    <div className={styles.bottomBar}>
                      <DsSectionCard border="block-start" padding="md">
                        <Button
                          fullWidth
                          justify="between"
                          emphasis="low"
                          labelWrap="wrap"
                          onClick={toggleDrawer}
                          aria-expanded={drawerOpened}
                          rightSection={drawerOpened ? <IconChevronDown size={20} /> : <IconChevronUp size={20} />}
                        >
                          <DsLayoutStack as="span" gap="none" flexible>
                            <DsText as="span" size="sm" weight="medium" lines={1}>
                              {formState.name || formState.address || t('selectLocation')}
                            </DsText>
                            <DsText as="span" size="xs" tone="secondary" lines={1}>
                              {formState.lat.toFixed(6)}, {formState.lng.toFixed(6)}
                            </DsText>
                          </DsLayoutStack>
                        </Button>
                      </DsSectionCard>
                    </div>
                  )}
                </div>
              </DsLayoutInset>

              {!isMobile && (
                <div className={styles.formPanel}>
                  <DsSectionCard padding="none" border="inline-start" stretch layout="stack" clip>
                    <DsLayoutInset space="md">
                      <DsLayoutInset space="none">
                        <PlacesAutocomplete
                          onPlaceSelect={handlePlaceSelect}
                          placeholder={tCommonPlaceholders('searchPlaces')}
                        />
                      </DsLayoutInset>
                    </DsLayoutInset>
                    <Divider />
                    <ScrollArea grow inset="md">
                      <PlaceDetailForm formState={formState} onFormChange={setFormState} loading={geocodingLoading} />
                    </ScrollArea>
                    {metadata ? (
                      <>
                        <Divider />
                        <DsLayoutInset space="md">
                          <DsLayoutInset space="none">{metadata}</DsLayoutInset>
                        </DsLayoutInset>
                      </>
                    ) : null}
                  </DsSectionCard>
                </div>
              )}
            </DsLayoutInline>
          )}
        </DsSectionCard>
      </div>

      {isMobile && !localOnly && (
        <Drawer
          opened={drawerOpened}
          onClose={toggleDrawer}
          placement="bottom"
          size="compact"
          closeLabel={tCommonActions('close')}
          title={
            <DsLayoutInline justify="between" fill="inline">
              <DsText weight="medium">{t('placeDetails')}</DsText>
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
            </DsLayoutInline>
          }
        >
          <ScrollArea size="viewport">
            <PlaceDetailForm formState={formState} onFormChange={setFormState} loading={geocodingLoading} />
            {metadata ? (
              <>
                <Divider spaceBefore="md" spaceAfter="md" />
                <DsLayoutInset blockEnd="md">
                  <DsLayoutInset space="none">{metadata}</DsLayoutInset>
                </DsLayoutInset>
              </>
            ) : null}
          </ScrollArea>
        </Drawer>
      )}

      {onDelete && (
        <ConfirmationDialog
          intent="delete"
          opened={deleteModalOpened}
          onClose={closeDeleteModal}
          onConfirm={handleDelete}
          title={t('deleteModal.title')}
          confirmLabel={tCommonActions('delete')}
          cancelLabel={tCommonActions('cancel')}
          closeLabel={tModalActions('close')}
          loading={isDeleting}
          message={
            <>
              <DsText>
                {tCommonMessages.rich('confirmDeleteNamedRich', {
                  name: formState.name,
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </DsText>
            </>
          }
        />
      )}
    </>
  );
}

function MappedPlaceEditor(props: PlaceEditorProps) {
  const geocodingLib = useMapsLibrary('geocoding');
  const placesLib = useMapsLibrary('places');
  return <PlaceEditorContent {...props} geocodingLib={geocodingLib} placesLib={placesLib} />;
}
export function PlaceEditor(props: PlaceEditorProps) {
  return props.localOnly ? (
    <PlaceEditorContent {...props} geocodingLib={null} placesLib={null} />
  ) : (
    <MapProvider>
      <MappedPlaceEditor {...props} />
    </MapProvider>
  );
}

function clonePlaceEditorFormState(state: PlaceEditorFormState): PlaceEditorFormState {
  return {
    ...state,
    addressComponents: state.addressComponents ? { ...state.addressComponents } : null,
  };
}

function diffPlaceEditorFormState(
  baseline: PlaceEditorFormState,
  next: PlaceEditorFormState,
): Partial<PlaceEditorFormState> {
  const updates: Partial<PlaceEditorFormState> = {};

  if (baseline.name !== next.name) {
    updates.name = next.name;
  }
  if (baseline.address !== next.address) {
    updates.address = next.address;
  }
  if (baseline.lat !== next.lat) {
    updates.lat = next.lat;
  }
  if (baseline.lng !== next.lng) {
    updates.lng = next.lng;
  }
  if (baseline.googlePlaceId !== next.googlePlaceId) {
    updates.googlePlaceId = next.googlePlaceId;
  }
  if (!sameAddressComponents(baseline.addressComponents, next.addressComponents)) {
    updates.addressComponents = next.addressComponents ? { ...next.addressComponents } : null;
  }

  return updates;
}

function sameAddressComponents(
  left: PlaceEditorFormState['addressComponents'],
  right: PlaceEditorFormState['addressComponents'],
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }

  return (
    left.street === right.street &&
    left.city === right.city &&
    left.region === right.region &&
    left.country === right.country &&
    left.postalCode === right.postalCode
  );
}
