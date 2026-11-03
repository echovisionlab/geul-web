'use client';
import { LayoutInline as DsLayoutInline, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { InputValidationGlyph } from '@/components/core/Input/InputGlyphs';
import { Select, useInputCombobox } from '@/components/core/Input';

import { useCallback, useMemo, useState } from 'react';
import { IconMapPin, IconPlus, IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/core/Button';
import { createMapPlaceBrowserClient } from '@/lib/api/map-place-browser-client';
import type { MapPlaceBasic } from '@/lib/types/map-place/model';

interface MapPlaceSelectProps {
  /** Currently selected place ID */
  value: string | null;
  /** Callback when a place is selected */
  onChange: (placeId: string | null, place: MapPlaceBasic | null) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Callback when "Create new" is clicked, receives search term */
  onCreateNew?: (searchTerm: string) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Label for the input */
  label?: string;
  /** Error message */
  error?: string;
  /** Show explicit "create new place" button below input */
  showCreateButton?: boolean;
}

export function MapPlaceSelect({
  value,
  onChange,
  placeholder,
  onCreateNew,
  disabled = false,
  label,
  error,
  showCreateButton = false,
}: MapPlaceSelectProps) {
  const t = useTranslations('mapPlaceSelect');
  const tCommonActions = useTranslations('common.actions');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const mapPlaceClient = useMemo(() => createMapPlaceBrowserClient(), []);
  const [search, setSearch] = useState('');
  const combobox = useInputCombobox();

  // Get selected place details
  const selectedPlaceQuery = useQuery({
    queryKey: ['mapPlace', value],
    queryFn: async () => {
      const response = await mapPlaceClient.getMapPlace({ id: value! });
      return {
        id: response.id,
        name: response.name,
        address: response.address,
        lat: response.lat,
        lng: response.lng,
      };
    },
    enabled: !!value,
  });

  // Search places
  const searchQuery = useQuery({
    queryKey: ['mapPlace', 'search', search],
    queryFn: async () => {
      const response = await mapPlaceClient.searchMapPlaces({ query: search, limit: 10 });
      return response.places.map((place) => ({
        id: place.id,
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
      }));
    },
    enabled: search.length > 0,
  });

  const { data: selectedPlace } = selectedPlaceQuery;
  const { data: searchResults } = searchQuery;
  const isLoading = selectedPlaceQuery.isFetching || searchQuery.isFetching;

  const handleInputChange = useCallback(
    (val: string) => {
      setSearch(val);
      if (val.trim()) {
        combobox.openDropdown();
      } else {
        combobox.closeDropdown();
      }
    },
    [combobox],
  );

  const handleOptionSubmit = useCallback(
    (optionValue: string) => {
      if (optionValue === '__create_new__') {
        onCreateNew?.(search.trim());
        setSearch('');
        combobox.closeDropdown();
        return;
      }

      const place = searchResults?.find((p) => p.id === optionValue);
      if (place) {
        onChange(optionValue, place);
        setSearch('');
        combobox.closeDropdown();
      }
    },
    [searchResults, onChange, combobox, onCreateNew, search],
  );

  const handleClear = useCallback(() => {
    onChange(null, null);
    setSearch('');
  }, [onChange]);

  return (
    <div>
      <QueryErrorAlert queries={[selectedPlaceQuery, searchQuery]} />
      <DsLayoutInline gap="xs" wrap="nowrap">
        <Select
          label={label}
          aria-label={label ? undefined : (placeholder ?? tCommonPlaceholders('searchPlaces'))}
          searchable
          disabled={disabled}
          error={error}
          placeholder={placeholder ?? tCommonPlaceholders('searchPlaces')}
          value={value}
          searchValue={combobox.dropdownOpened ? search : (selectedPlace?.name ?? search)}
          onSearchChange={handleInputChange}
          dropdownOpened={combobox.dropdownOpened}
          onDropdownOpen={combobox.openDropdown}
          onDropdownClose={combobox.closeDropdown}
          data={[
            ...(selectedPlace ? [{ value: selectedPlace.id, label: selectedPlace.name }] : []),
            ...(searchResults ?? [])
              .filter((item) => item.id !== selectedPlace?.id)
              .map((item) => ({ value: item.id, label: item.name })),
            ...(onCreateNew && search.trim()
              ? [{ value: '__create_new__', label: tCommonActions('createNamed', { name: search.trim() }) }]
              : []),
          ]}
          onChange={(id) => {
            if (id) {
              handleOptionSubmit(id);
            }
          }}
          leftSection={selectedPlace ? <IconMapPin size={16} /> : <IconSearch size={16} />}
          aria-busy={isLoading || undefined}
          rightSection={isLoading ? <InputValidationGlyph status="checking" /> : undefined}
          grow
          renderOption={({ option }) => {
            const place = searchResults?.find((item) => item.id === option.value);
            return place ? (
              <div>
                <strong>{place.name}</strong>
                <div>{place.address}</div>
              </div>
            ) : (
              option.label
            );
          }}
        />

        {selectedPlace && (
          <Button tone="neutral" emphasis="low" size="sm" onClick={handleClear}>
            {t('clear')}
          </Button>
        )}
      </DsLayoutInline>

      {selectedPlace && (
        <DsLayoutInset blockStart="xxs">
          <DsText size="xs" tone="secondary">
            {selectedPlace.address}
          </DsText>
        </DsLayoutInset>
      )}

      {onCreateNew && showCreateButton && !selectedPlace && (
        <DsLayoutInset blockStart="xs">
          <DsLayoutInline justify="end">
            <Button
              size="xs"
              emphasis="medium"
              leftSection={<IconPlus size={14} />}
              onClick={() => onCreateNew(search.trim())}
              disabled={disabled}
            >
              {search.trim() ? tCommonActions('createNamed', { name: search.trim() }) : t('createNew')}
            </Button>
          </DsLayoutInline>
        </DsLayoutInset>
      )}
    </div>
  );
}
