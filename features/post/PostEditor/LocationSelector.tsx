'use client';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { Select, useInputCombobox } from '@/components/core/Input';

import { useCallback, useMemo, useState } from 'react';
import { IconMapPin } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { createMapPlaceBrowserClient } from '@/lib/api/map-place-browser-client';

interface LocationSelectorProps {
  value: string | null;
  idPrefix?: string;
  canEdit: boolean;
  onChange: (placeId: string | null) => void;
  onCreateNew?: (searchTerm: string) => void;
}

export function LocationSelector({ value, idPrefix, canEdit, onChange, onCreateNew }: LocationSelectorProps) {
  const tCommon = useTranslations('common');
  const t = useTranslations('locationSelector');
  const mapPlaceClient = useMemo(() => createMapPlaceBrowserClient(), []);
  const [search, setSearch] = useState('');

  const combobox = useInputCombobox({
    onDropdownClose: () => {
      setSearch('');
    },
  });

  const { data: selectedPlace, isLoading: isSelectedPlaceLoading } = useQuery({
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

  const { data: searchResults = [], isLoading: isSearchLoading } = useQuery({
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
    enabled: search.trim().length > 0,
  });

  const handleSelect = useCallback(
    (optionValue: string) => {
      if (optionValue === '$create') {
        onCreateNew?.(search.trim());
        combobox.closeDropdown();
        return;
      }

      onChange(optionValue);
      combobox.closeDropdown();
    },
    [combobox, onChange, onCreateNew, search],
  );

  const exactMatch = searchResults.some((place) => place.name.toLowerCase() === search.trim().toLowerCase());
  const canCreate = Boolean(onCreateNew && search.trim().length > 0 && !exactMatch);
  const isLoading = isSelectedPlaceLoading || isSearchLoading;

  return (
    <DsLayoutStack gap="xxs">
      <Select
        id={idPrefix ? `${idPrefix}-trigger` : undefined}
        label={tCommon('labels.location')}
        searchable
        disabled={!canEdit}
        placeholder={t('placeholder')}
        value={value}
        searchValue={combobox.dropdownOpened ? search : (selectedPlace?.name ?? '')}
        onSearchChange={setSearch}
        dropdownOpened={combobox.dropdownOpened}
        onDropdownOpen={combobox.openDropdown}
        onDropdownClose={combobox.closeDropdown}
        clearable={Boolean(value && canEdit)}
        onChange={(id) => {
          if (id) {
            handleSelect(id);
          } else {
            onChange(null);
            setSearch('');
          }
        }}
        leftSection={<IconMapPin size={16} />}
        aria-busy={isLoading || undefined}
        data={[
          ...(selectedPlace ? [{ value: selectedPlace.id, label: selectedPlace.name }] : []),
          ...searchResults
            .filter((place) => place.id !== value)
            .map((place) => ({ value: place.id, label: place.name })),
          ...(canCreate ? [{ value: '$create', label: tCommon('actions.createNamed', { name: search.trim() }) }] : []),
        ]}
        nothingFoundMessage={search.trim() ? t('emptyResults') : t('emptySearch')}
        renderOption={({ option }) => {
          const place = searchResults.find((item) => item.id === option.value);
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

      {selectedPlace?.address && (
        <DsText size="xs" tone="secondary" lines={1}>
          {selectedPlace.address}
        </DsText>
      )}
    </DsLayoutStack>
  );
}
