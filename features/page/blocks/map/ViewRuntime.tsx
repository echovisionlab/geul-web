'use client';

import { Box, Text } from '@mantine/core';
import { MapViewEmbedded } from '@/features/map/MapViewEmbedded';
import { toMapConfig } from '@/lib/types/map-block/converters';
import { normalizeMapBlockPropsInput } from '@/lib/types/map-block/schema';
import type { MapViewConfig } from '@/lib/types/map/model';
import type { BlockViewProps } from '../types';

export function MapView({ props, requestedLocale }: BlockViewProps) {
  // Check for embedded data (new format)
  const hydratedMapViewConfig = props.mapViewConfig as MapViewConfig | undefined;
  const normalizedProps = normalizeMapBlockPropsInput(props);
  const fallbackConfig = toMapConfig(normalizedProps);
  const mapViewConfig: MapViewConfig = hydratedMapViewConfig ?? {
    ...fallbackConfig,
    preferredScheme: fallbackConfig.preferredScheme ?? 'auto',
    places: [],
    theme: null,
  };
  const blockAlignment =
    props.textAlignment === 'left' || props.textAlignment === 'center' || props.textAlignment === 'right'
      ? props.textAlignment
      : undefined;
  const caption = typeof props.caption === 'string' ? props.caption.trim() : '';

  return (
    <Box>
      <MapViewEmbedded
        config={mapViewConfig}
        allowEmpty
        blockAlignment={blockAlignment}
        labelLocale={requestedLocale}
        caption={
          caption ? (
            <Text
              data-public-map-caption=""
              size="sm"
              c="dimmed"
              style={{
                display: 'block',
                width: '100%',
                minHeight: 20,
                marginTop: '0.25rem',
                padding: 0,
                textAlign: 'left',
                fontFamily: 'inherit',
                fontSize: 'var(--mantine-font-size-sm)',
                fontWeight: 'inherit',
                lineHeight: 1.55,
              }}
            >
              {caption}
            </Text>
          ) : null
        }
      />
    </Box>
  );
}
