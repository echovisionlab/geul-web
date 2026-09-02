'use client';

import { useCallback, useEffect, useState } from 'react';
import { IconChevronDown } from '@tabler/icons-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useTranslations } from 'next-intl';
import { Accordion, Box, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { TextInput, NumberInput } from '@/components/core/Input';
import { BaseMap } from '@/features/map/BaseMap';
import { Marker } from '@/features/map/Marker';
import { MapProvider } from '@/features/map/MapProvider';
import { PlacesAutocomplete } from '@/features/place/PlacesAutocomplete';
import type { GooglePlaceSearchResult } from '@/lib/types/location/model';
import type { AddressComponents } from '@/lib/types/map-place/model';
import { DEFAULT_CENTER } from '@/lib/types/map/model';
import { parseAddressComponents, parseGeocoderAddressComponents } from '@/lib/utils/address';

export interface CreatePlaceFormState {
  name: string;
  address: string;
  lat: number;
  lng: number;
  googlePlaceId: string | null;
  addressComponents: AddressComponents | null;
}

const initialFormState: CreatePlaceFormState = {
  name: '',
  address: '',
  lat: DEFAULT_CENTER.lat,
  lng: DEFAULT_CENTER.lng,
  googlePlaceId: null,
  addressComponents: null,
};

interface CreatePlaceModalContentProps {
  formState: CreatePlaceFormState;
  setFormState: React.Dispatch<React.SetStateAction<CreatePlaceFormState>>;
  isPending: boolean;
  isFormValid: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

function CreatePlaceModalContent({
  formState,
  setFormState,
  isPending,
  isFormValid,
  onSubmit,
  onClose,
}: CreatePlaceModalContentProps) {
  const t = useTranslations('createPlaceModal');
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const geocodingLib = useMapsLibrary('geocoding');
  const placesLib = useMapsLibrary('places');
  const [locationPicked, setLocationPicked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Search result: auto-fill all fields (uses Places API - parseAddressComponents)
  const handlePlaceSelect = useCallback(
    (result: GooglePlaceSearchResult) => {
      setFormState((prev) => ({
        ...prev,
        name: result.name ?? prev.name,
        address: result.address ?? '',
        lat: result.coordinate.lat,
        lng: result.coordinate.lng,
        googlePlaceId: result.placeId,
        addressComponents: result.addressComponents ?? null,
      }));
      setLocationPicked(true);
    },
    [setFormState],
  );

  // Map click/long-press: set coordinates and reverse geocode
  const handleMapSelect = useCallback(
    async (lat: number, lng: number) => {
      setFormState((prev) => ({
        ...prev,
        lat,
        lng,
        googlePlaceId: null,
      }));
      setLocationPicked(true);

      // Reverse geocode to get address
      if (geocodingLib) {
        setIsLoading(true);
        try {
          const geocoder = new geocodingLib.Geocoder();
          const response = await geocoder.geocode({ location: { lat, lng } });

          if (response.results && response.results.length > 0) {
            const result = response.results[0];
            setFormState((prev) => ({
              ...prev,
              address: result.formatted_address,
              addressComponents: parseGeocoderAddressComponents(result.address_components),
            }));
          }
        } catch {
          // Ignore errors
        } finally {
          setIsLoading(false);
        }
      }
    },
    [geocodingLib, setFormState],
  );

  // POI click: fetch place details and auto-fill (uses Places API - parseAddressComponents)
  const handlePoiClick = useCallback(
    async (placeId: string, lat: number, lng: number) => {
      setFormState((prev) => ({
        ...prev,
        lat,
        lng,
        googlePlaceId: placeId,
      }));
      setLocationPicked(true);

      if (placesLib) {
        setIsLoading(true);
        try {
          const place = new placesLib.Place({ id: placeId });
          await place.fetchFields({
            fields: ['displayName', 'formattedAddress', 'addressComponents'],
          });

          setFormState((prev) => ({
            ...prev,
            name: place.displayName || prev.name,
            address: place.formattedAddress || prev.address,
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

              if (response.results && response.results.length > 0) {
                const result = response.results[0];
                setFormState((prev) => ({
                  ...prev,
                  address: result.formatted_address,
                  addressComponents: parseGeocoderAddressComponents(result.address_components),
                }));
              }
            } catch {
              // Ignore errors
            }
          }
        } finally {
          setIsLoading(false);
        }
      }
    },
    [placesLib, geocodingLib, setFormState],
  );

  return (
    <Stack>
      <PlacesAutocomplete onPlaceSelect={handlePlaceSelect} placeholder={t('searchPlaceholder')} />

      <Text size="xs" c="dimmed">
        {t('searchHelper')}
      </Text>

      <Box
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          overflow: 'hidden',
          borderRadius: 'var(--mantine-radius-md)',
          cursor: 'crosshair',
        }}
      >
        <BaseMap
          center={{ lat: formState.lat, lng: formState.lng }}
          zoom={locationPicked ? 15 : 12}
          panTo={locationPicked ? { lat: formState.lat, lng: formState.lng } : null}
          gestureHandling="greedy"
          clickableIcons
          onClick={handleMapSelect}
          onLongPress={handleMapSelect}
          onPoiClick={handlePoiClick}
        >
          {locationPicked && <Marker position={{ lat: formState.lat, lng: formState.lng }} />}
        </BaseMap>
      </Box>

      <TextInput
        label={tCommonLabels('name')}
        placeholder={tCommonPlaceholders('placeName')}
        value={formState.name}
        onChange={(event) => {
          const value = event.currentTarget.value;
          setFormState((prev) => ({ ...prev, name: value }));
        }}
        required
      />

      <TextInput
        label={tCommonLabels('address')}
        placeholder={tCommonPlaceholders('fullAddress')}
        value={formState.address}
        onChange={(event) => {
          const value = event.currentTarget.value;
          setFormState((prev) => ({ ...prev, address: value }));
        }}
        required
      />

      <Group grow>
        <NumberInput
          label={tCommonLabels('latitude')}
          value={formState.lat}
          onChange={(v) => setFormState((prev) => ({ ...prev, lat: Number(v) || 0, googlePlaceId: null }))}
          decimalScale={6}
          step={0.000001}
          size="xs"
        />
        <NumberInput
          label={tCommonLabels('longitude')}
          value={formState.lng}
          onChange={(v) => setFormState((prev) => ({ ...prev, lng: Number(v) || 0, googlePlaceId: null }))}
          decimalScale={6}
          step={0.000001}
          size="xs"
        />
      </Group>

      <Accordion variant="contained" chevron={<IconChevronDown size={16} />}>
        <Accordion.Item value="address-details">
          <Accordion.Control>
            <Group gap="xs">
              <Text size="sm">{tCommonLabels('addressDetails')}</Text>
              {isLoading && <Loader size={14} />}
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <TextInput
                label={tCommonLabels('street')}
                placeholder={tCommonPlaceholders('streetAddress')}
                size="xs"
                value={formState.addressComponents?.street ?? ''}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setFormState((prev) => ({
                    ...prev,
                    addressComponents: {
                      ...prev.addressComponents,
                      street: value || undefined,
                    },
                  }));
                }}
              />
              <Group grow>
                <TextInput
                  label={tCommonLabels('city')}
                  placeholder={tCommonLabels('city')}
                  size="xs"
                  value={formState.addressComponents?.city ?? ''}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setFormState((prev) => ({
                      ...prev,
                      addressComponents: {
                        ...prev.addressComponents,
                        city: value || undefined,
                      },
                    }));
                  }}
                />
                <TextInput
                  label={tCommonLabels('postalCode')}
                  placeholder={tCommonLabels('postalCode')}
                  size="xs"
                  value={formState.addressComponents?.postalCode ?? ''}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setFormState((prev) => ({
                      ...prev,
                      addressComponents: {
                        ...prev.addressComponents,
                        postalCode: value || undefined,
                      },
                    }));
                  }}
                />
              </Group>
              <Group grow>
                <TextInput
                  label={tCommonLabels('region')}
                  placeholder={tCommonPlaceholders('regionSubdivision')}
                  size="xs"
                  value={formState.addressComponents?.region ?? ''}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setFormState((prev) => ({
                      ...prev,
                      addressComponents: {
                        ...prev.addressComponents,
                        region: value || undefined,
                      },
                    }));
                  }}
                />
                <TextInput
                  label={tCommonLabels('country')}
                  placeholder={tCommonLabels('country')}
                  size="xs"
                  value={formState.addressComponents?.country ?? ''}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setFormState((prev) => ({
                      ...prev,
                      addressComponents: {
                        ...prev.addressComponents,
                        country: value || undefined,
                      },
                    }));
                  }}
                />
              </Group>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <Group justify="flex-end">
        <Button emphasis="low" onClick={onClose} disabled={isPending}>
          {tCommonActions('cancel')}
        </Button>
        <Button onClick={onSubmit} loading={isPending} disabled={!isFormValid || isPending}>
          {t('actions.createAndAdd')}
        </Button>
      </Group>
    </Stack>
  );
}

interface CreatePlaceModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePlaceFormState) => void;
  isPending?: boolean;
  /** Initial name to pre-fill (e.g., from search term) */
  initialName?: string;
}

export function CreatePlaceModal({ opened, onClose, onSubmit, isPending = false, initialName }: CreatePlaceModalProps) {
  const t = useTranslations('createPlaceModal');
  const [formState, setFormState] = useState<CreatePlaceFormState>(initialFormState);

  // Reset form with initialName when modal opens
  useEffect(() => {
    if (opened) {
      setFormState({
        ...initialFormState,
        name: initialName ?? '',
      });
    }
  }, [opened, initialName]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(() => {
    onSubmit(formState);
    setFormState(initialFormState);
  }, [formState, onSubmit]);

  const isFormValid = Boolean(formState.name.trim() && formState.address.trim());

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t('title')}
      size="lg"
      closeOnClickOutside={!isPending}
      closeOnEscape={!isPending}
      withCloseButton={!isPending}
    >
      <MapProvider>
        <CreatePlaceModalContent
          formState={formState}
          setFormState={setFormState}
          isPending={isPending}
          isFormValid={isFormValid}
          onSubmit={handleSubmit}
          onClose={handleClose}
        />
      </MapProvider>
    </Modal>
  );
}
