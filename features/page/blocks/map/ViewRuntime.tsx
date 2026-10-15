'use client';

import { LayoutInset } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';

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
    <div>
      <MapViewEmbedded
        config={mapViewConfig}
        allowEmpty
        blockAlignment={blockAlignment}
        labelLocale={requestedLocale}
        caption={
          caption ? (
            <LayoutInset blockStart="xxs">
              <DsText align="start" size="xs" data-public-map-caption="" tone="muted">
                {caption}
              </DsText>
            </LayoutInset>
          ) : null
        }
      />
    </div>
  );
}
