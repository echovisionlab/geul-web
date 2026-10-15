'use client';

import {
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
} from '@/components/core/Layout';

import { Text as DsText } from '@/components/core/Typography';
import { useCallback, useEffect, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useTranslations } from 'next-intl';

import { Disclosure } from '@/components/core/Disclosure';
import { Spinner as Loader } from '@/components/core/Display';
import { ContentModal, DialogActions } from '@/components/core/Modal';
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
  localOnly?: boolean;
  geocodingLib: google.maps.GeocodingLibrary | null;
  placesLib: google.maps.PlacesLibrary | null;
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
  localOnly,
  geocodingLib,
  placesLib,
}: CreatePlaceModalContentProps) {
  const t = useTranslations('createPlaceModal');
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonPlaceholders = useTranslations('common.placeholders');
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
    <DsLayoutStack>
      {!localOnly && (
        <>
          <PlacesAutocomplete onPlaceSelect={handlePlaceSelect} placeholder={t('searchPlaceholder')} />

          <DsText size="xs" tone="secondary">
            {t('searchHelper')}
          </DsText>

          <div style={{ width: '100%', aspectRatio: '16 / 9', overflow: 'hidden', cursor: 'crosshair' }}>
            <DsLayoutInset space="none">
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
            </DsLayoutInset>
          </div>
        </>
      )}

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

      <DsLayoutInline grow>
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
      </DsLayoutInline>

      <Disclosure
        appearance="filled"
        label={
          <>
            <DsText as="span" size="sm">
              {tCommonLabels('addressDetails')}
            </DsText>
            {isLoading && <Loader size="xs" />}
          </>
        }
      >
        <DsLayoutStack gap="sm">
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
          <DsLayoutInline grow>
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
          </DsLayoutInline>
          <DsLayoutInline grow>
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
          </DsLayoutInline>
        </DsLayoutStack>
      </Disclosure>

      <DialogActions>
        <Button emphasis="low" onClick={onClose} disabled={isPending}>
          {tCommonActions('cancel')}
        </Button>
        <Button emphasis="strong" onClick={onSubmit} loading={isPending} disabled={!isFormValid || isPending}>
          {t('actions.createAndAdd')}
        </Button>
      </DialogActions>
    </DsLayoutStack>
  );
}

interface CreatePlaceModalProps {
  /** Keep manual inputs available when an external map service is unavailable. */
  localOnly?: boolean;
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePlaceFormState) => void;
  isPending?: boolean;
  /** Initial name to pre-fill (e.g., from search term) */
  initialName?: string;
}

export function CreatePlaceModal({
  opened,
  onClose,
  onSubmit,
  isPending = false,
  initialName,
  localOnly = false,
}: CreatePlaceModalProps) {
  const tModalActions = useTranslations('common.actions');
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

  const contentProps = {
    formState,
    setFormState,
    isPending,
    isFormValid,
    onSubmit: handleSubmit,
    onClose: handleClose,
  };
  return (
    <ContentModal
      opened={opened}
      onClose={handleClose}
      title={t('title')}
      size="large"
      closeLabel={tModalActions('close')}
      loading={isPending}
    >
      {localOnly ? (
        <CreatePlaceModalContent {...contentProps} localOnly geocodingLib={null} placesLib={null} />
      ) : (
        <MapProvider>
          <MappedCreatePlaceModalContent {...contentProps} />
        </MapProvider>
      )}
    </ContentModal>
  );
}

function MappedCreatePlaceModalContent(props: Omit<CreatePlaceModalContentProps, 'geocodingLib' | 'placesLib'>) {
  const geocodingLib = useMapsLibrary('geocoding');
  const placesLib = useMapsLibrary('places');
  return <CreatePlaceModalContent {...props} geocodingLib={geocodingLib} placesLib={placesLib} />;
}
