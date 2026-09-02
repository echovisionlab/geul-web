'use client';

import { useCallback, useMemo, useState } from 'react';
import { IconMapPin, IconPlus, IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Combobox, Group, InputBase, Loader, Text, useCombobox } from '@mantine/core';
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
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  // Get selected place details
  const { data: selectedPlace } = useQuery({
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
  const { data: searchResults, isLoading } = useQuery({
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

  const displayValue = selectedPlace ? selectedPlace.name : search;

  return (
    <Box>
      {label && (
        <Text size="sm" fw={500} mb={4}>
          {label}
        </Text>
      )}
      <Group gap="xs" align="flex-start">
        <Combobox store={combobox} onOptionSubmit={handleOptionSubmit}>
          <Combobox.Target>
            <InputBase
              leftSection={selectedPlace ? <IconMapPin size={16} /> : <IconSearch size={16} />}
              rightSection={isLoading ? <Loader size={16} /> : null}
              placeholder={selectedPlace ? undefined : (placeholder ?? tCommonPlaceholders('searchPlaces'))}
              value={displayValue}
              onChange={(e) => handleInputChange(e.currentTarget.value)}
              onClick={() => {
                if (!selectedPlace && search.length > 0 && searchResults && searchResults.length > 0) {
                  combobox.openDropdown();
                }
              }}
              onFocus={() => {
                if (!selectedPlace && search.length > 0 && searchResults && searchResults.length > 0) {
                  combobox.openDropdown();
                }
              }}
              onBlur={() => setTimeout(() => combobox.closeDropdown(), 300)}
              disabled={disabled}
              error={error}
              rightSectionPointerEvents={selectedPlace ? 'all' : 'none'}
              style={{ flex: 1 }}
            />
          </Combobox.Target>

          <Combobox.Dropdown hidden={!search.trim() || (!searchResults?.length && !onCreateNew)}>
            <Combobox.Options>
              {searchResults?.map((place) => (
                <Combobox.Option key={place.id} value={place.id} onMouseDown={(e) => e.preventDefault()}>
                  <div>
                    <Text size="sm" fw={500}>
                      {place.name}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {place.address}
                    </Text>
                  </div>
                </Combobox.Option>
              ))}
              {onCreateNew && search.trim() && (
                <Combobox.Option value="__create_new__" onMouseDown={(e) => e.preventDefault()}>
                  <Group gap="xs">
                    <IconPlus size={16} />
                    <Text size="sm">{tCommonActions('createNamed', { name: search.trim() })}</Text>
                  </Group>
                </Combobox.Option>
              )}
            </Combobox.Options>
          </Combobox.Dropdown>
        </Combobox>

        {selectedPlace && (
          <Button tone="neutral" emphasis="low" size="sm" onClick={handleClear}>
            {t('clear')}
          </Button>
        )}
      </Group>

      {selectedPlace && (
        <Text size="xs" c="dimmed" mt={4}>
          {selectedPlace.address}
        </Text>
      )}

      {onCreateNew && showCreateButton && !selectedPlace && (
        <Group justify="flex-end" mt={8}>
          <Button
            size="xs"
            emphasis="medium"
            leftSection={<IconPlus size={14} />}
            onClick={() => onCreateNew(search.trim())}
            disabled={disabled}
          >
            {search.trim() ? tCommonActions('createNamed', { name: search.trim() }) : t('createNew')}
          </Button>
        </Group>
      )}
    </Box>
  );
}
