'use client';

import { useCallback, useMemo, useState, type MouseEvent } from 'react';
import { IconMapPin, IconPlus, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Combobox, Group, InputBase, Loader, Stack, Text, useCombobox } from '@mantine/core';
import { IconButton } from '@/components/core/IconButton';
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
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const t = useTranslations('locationSelector');
  const mapPlaceClient = useMemo(() => createMapPlaceBrowserClient(), []);
  const [search, setSearch] = useState('');

  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
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

  const handleClear = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onChange(null);
      setSearch('');
    },
    [onChange],
  );

  const exactMatch = searchResults.some((place) => place.name.toLowerCase() === search.trim().toLowerCase());
  const canCreate = Boolean(onCreateNew && search.trim().length > 0 && !exactMatch);
  const isLoading = isSelectedPlaceLoading || isSearchLoading;

  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed">
        {tCommon('labels.location')}
      </Text>
      <Combobox store={combobox} onOptionSubmit={handleSelect} withinPortal={false} disabled={!canEdit}>
        <Combobox.DropdownTarget>
          <InputBase
            id={idPrefix ? `${idPrefix}-trigger` : undefined}
            component="button"
            type="button"
            pointer
            onClick={() => canEdit && combobox.toggleDropdown()}
            leftSection={<IconMapPin size={16} />}
            rightSection={
              isLoading ? (
                <Loader size={16} />
              ) : value && canEdit ? (
                <IconButton size="xs" emphasis="low" onClick={handleClear} aria-label={t('clearSelection')}>
                  <IconX size={14} />
                </IconButton>
              ) : null
            }
            disabled={!canEdit}
            rightSectionPointerEvents={value && canEdit ? 'all' : 'none'}
          >
            {selectedPlace ? (
              <Text size="sm">{selectedPlace.name}</Text>
            ) : (
              <Text size="sm" c="dimmed">
                {t('placeholder')}
              </Text>
            )}
          </InputBase>
        </Combobox.DropdownTarget>

        <Combobox.Dropdown>
          <Combobox.Search
            id={idPrefix ? `${idPrefix}-search` : undefined}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder={tCommonPlaceholders('searchPlaces')}
          />
          <Combobox.Options>
            {searchResults.map((place) => (
              <Combobox.Option key={place.id} value={place.id} active={place.id === value}>
                <Stack gap={2}>
                  <Text size="sm">{place.name}</Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {place.address}
                  </Text>
                </Stack>
              </Combobox.Option>
            ))}

            {canCreate && (
              <Combobox.Option value="$create">
                <Group gap="xs">
                  <IconPlus size={14} />
                  <Text size="sm">{tCommon('actions.createNamed', { name: search.trim() })}</Text>
                </Group>
              </Combobox.Option>
            )}

            {search.trim().length === 0 && <Combobox.Empty>{t('emptySearch')}</Combobox.Empty>}

            {search.trim().length > 0 && searchResults.length === 0 && !canCreate && (
              <Combobox.Empty>{t('emptyResults')}</Combobox.Empty>
            )}
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>

      {selectedPlace?.address && (
        <Text size="xs" c="dimmed" lineClamp={1}>
          {selectedPlace.address}
        </Text>
      )}
    </Stack>
  );
}
