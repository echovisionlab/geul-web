'use client';

import { useCallback, useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useLocale, useTranslations } from 'next-intl';
import { Combobox, InputBase, Loader, useCombobox } from '@mantine/core';
import type { GooglePlaceSearchResult } from '@/lib/types/location/model';
import { parseAddressComponents } from '@/lib/utils/address';

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface PlacesAutocompleteProps {
  /** Callback with GooglePlaceSearchResult (new interface) */
  onPlaceSelect: (result: GooglePlaceSearchResult) => void;
  placeholder?: string;
}

export function PlacesAutocomplete({ onPlaceSelect, placeholder }: PlacesAutocompleteProps) {
  const locale = useLocale();
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const placesLib = useMapsLibrary('places');

  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const searchPlaces = useCallback(
    async (input: string) => {
      if (!placesLib || !input.trim()) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        const request = {
          input,
          language: locale,
        };

        const { suggestions: results } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

        const mapped: Suggestion[] = results
          .map((s) => {
            const prediction = s.placePrediction;
            if (!prediction) {
              return null;
            }
            return {
              placeId: prediction.placeId,
              mainText: prediction.mainText?.text ?? '',
              secondaryText: prediction.secondaryText?.text ?? '',
            };
          })
          .filter((s): s is Suggestion => s !== null);

        setSuggestions(mapped);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [placesLib],
  );

  const handleInputChange = useCallback(
    (val: string) => {
      setValue(val);
      if (val.trim()) {
        combobox.openDropdown();
        searchPlaces(val);
      } else {
        combobox.closeDropdown();
        setSuggestions([]);
      }
    },
    [combobox, searchPlaces],
  );

  const handleOptionSubmit = useCallback(
    async (placeId: string) => {
      if (!placesLib) {
        return;
      }

      const suggestion = suggestions.find((s) => s.placeId === placeId);
      if (!suggestion) {
        return;
      }

      setValue(suggestion.mainText);
      combobox.closeDropdown();

      try {
        const place = new placesLib.Place({ id: placeId });
        await place.fetchFields({
          fields: ['location', 'displayName', 'formattedAddress', 'addressComponents', 'photos'],
        });

        if (place.location) {
          // Get first photo URL
          let photoUrl: string | undefined;
          if (place.photos && place.photos.length > 0) {
            photoUrl = place.photos[0].getURI({ maxWidth: 400, maxHeight: 300 });
          }

          onPlaceSelect({
            placeId,
            coordinate: {
              lat: place.location.lat(),
              lng: place.location.lng(),
            },
            name: place.displayName ?? undefined,
            address: place.formattedAddress ?? undefined,
            addressComponents: place.addressComponents ? parseAddressComponents(place.addressComponents) : undefined,
            photoUrl,
          });
        }
      } catch {
        // Silently fail
      }
    },
    [placesLib, suggestions, combobox, onPlaceSelect],
  );

  if (!placesLib) {
    return (
      <InputBase
        leftSection={<IconSearch size={16} />}
        placeholder={placeholder ?? tCommonPlaceholders('searchPlaces')}
        disabled
        rightSection={<Loader size={16} />}
      />
    );
  }

  return (
    <Combobox store={combobox} onOptionSubmit={handleOptionSubmit}>
      <Combobox.Target>
        <InputBase
          leftSection={<IconSearch size={16} />}
          rightSection={loading ? <Loader size={16} /> : null}
          placeholder={placeholder ?? tCommonPlaceholders('searchPlaces')}
          value={value}
          onChange={(e) => handleInputChange(e.currentTarget.value)}
          onClick={() => {
            if (suggestions.length > 0) {
              combobox.openDropdown();
            }
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              combobox.openDropdown();
            }
          }}
          onBlur={() => combobox.closeDropdown()}
        />
      </Combobox.Target>

      <Combobox.Dropdown hidden={suggestions.length === 0}>
        <Combobox.Options>
          {suggestions.map((suggestion) => (
            <Combobox.Option key={suggestion.placeId} value={suggestion.placeId}>
              <div>
                <div style={{ fontWeight: 500 }}>{suggestion.mainText}</div>
                <div style={{ fontSize: '0.85em', color: 'var(--mantine-color-dimmed)' }}>
                  {suggestion.secondaryText}
                </div>
              </div>
            </Combobox.Option>
          ))}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
