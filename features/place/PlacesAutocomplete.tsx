'use client';
import { Alert } from '@/components/core/Alert';
import { SearchComboboxView, SearchInput, useInputCombobox } from '@/components/core/Input';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useLocale, useTranslations } from 'next-intl';
import { Spinner as Loader } from '@/components/core/Display';
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
  const tMap = useTranslations('searchCombobox');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const placesLib = useMapsLibrary('places');

  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const tCommonMessages = useTranslations('common.messages');
  const requestRef = useRef(0);
  useEffect(() => {
    requestRef.current++;
    setSuggestions([]);
    setLoading(false);
    setError(undefined);
    return () => {
      requestRef.current++;
    };
  }, [locale, placesLib]);

  const combobox = useInputCombobox();

  const searchPlaces = useCallback(
    async (input: string) => {
      const request = ++requestRef.current;
      if (!placesLib || !input.trim()) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      setError(undefined);
      setSuggestions([]);
      try {
        const searchRequest = {
          input,
          language: locale,
        };

        const { suggestions: results } =
          await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions(searchRequest);

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

        if (requestRef.current === request) {
          setSuggestions(mapped);
        }
      } catch {
        if (requestRef.current === request) {
          setSuggestions([]);
          setError(tCommonMessages('failedToLoad'));
        }
      } finally {
        if (requestRef.current === request) {
          setLoading(false);
        }
      }
    },
    [placesLib, locale, tCommonMessages],
  );

  const handleInputChange = useCallback(
    (val: string) => {
      setValue(val);
      if (val.trim()) {
        combobox.openDropdown();
        searchPlaces(val);
      } else {
        combobox.closeDropdown();
        requestRef.current++;
        setLoading(false);
        setError(undefined);
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

      const request = ++requestRef.current;
      setLoading(true);
      setError(undefined);
      setValue(suggestion.mainText);
      combobox.closeDropdown();

      try {
        const place = new placesLib.Place({ id: placeId });
        await place.fetchFields({
          fields: ['location', 'displayName', 'formattedAddress', 'addressComponents', 'photos'],
        });

        if (requestRef.current !== request) {
          return;
        }
        if (!place.location) {
          throw new Error('Missing place location');
        }
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
        if (requestRef.current === request) {
          setError(tCommonMessages('failedToLoad'));
        }
      } finally {
        if (requestRef.current === request) {
          setLoading(false);
        }
      }
    },
    [placesLib, suggestions, combobox, onPlaceSelect, tCommonMessages],
  );

  if (!placesLib) {
    return (
      <SearchInput
        placeholder={placeholder ?? tCommonPlaceholders('searchPlaces')}
        disabled
        rightSection={<Loader size="xs" />}
      />
    );
  }

  return (
    <>
      {error ? (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      ) : null}
      <SearchComboboxView
        combobox={combobox}
        search={value}
        onSearchChange={handleInputChange}
        placeholder={placeholder ?? tCommonPlaceholders('searchPlaces')}
        items={loading || error ? [] : suggestions}
        error={error}
        debouncedSearch={value}
        minQueryLength={1}
        isLoading={loading}
        onSelect={(id) => {
          void handleOptionSubmit(id);
        }}
        getItemId={(item) => item.placeId}
        getItemText={(item) => [item.mainText, item.secondaryText].filter(Boolean).join(' ')}
        renderItem={(item) => (
          <div>
            <strong>{item.mainText}</strong>
            <div>{item.secondaryText}</div>
          </div>
        )}
        minimumQueryMessage={tCommonPlaceholders('searchPlaces')}
        noResultsMessage={tMap('noResults')}
        leadingGlyph="search"
      />
    </>
  );
}
