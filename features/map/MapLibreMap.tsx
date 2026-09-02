'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { PageLoader } from '@/features/site/PageLoader';
import { getPrimaryCalloutText } from './callout-model';
import { useMapLoadingState } from './hooks';
import type { MapLibreMapProps } from './MapLibreMap.types';
import { MapLibreMapRuntime } from './MapLibreMapRuntime';

export type { MapLibreMapProps } from './MapLibreMap.types';

/**
 * Public map controller. It resolves translations and site-owned loading UI before
 * handing browser and MapLibre behavior to the runtime layer.
 */
export function MapLibreMap(props: MapLibreMapProps) {
  const t = useTranslations('map');
  const tCommonLabels = useTranslations('common.labels');
  const tLoading = useTranslations('map.loading');
  const loadingMessages = useMemo(
    () => ({
      connecting: tLoading('connecting'),
      loading: tLoading('loading'),
      rendering: tLoading('rendering'),
    }),
    [tLoading],
  );
  const { setLoadingStage, isReady, loadingMessage } = useMapLoadingState(loadingMessages);
  const calloutFields = props.themeConfig.calloutFields;
  const markerAccessibilityLabels = useMemo(
    () =>
      Object.fromEntries(
        props.places.map((place) => [
          place.id,
          t('accessibility.mapMarker', {
            label: getPrimaryCalloutText(place, calloutFields),
          }),
        ]),
      ),
    [calloutFields, props.places, t],
  );

  return (
    <MapLibreMapRuntime
      {...props}
      labels={{
        map: tCommonLabels('map'),
        markerAccessibilityLabels,
        zoomIn: t('accessibility.zoomIn'),
        zoomOut: t('accessibility.zoomOut'),
        resetNorth: t('accessibility.resetNorth'),
        directions: t('directions'),
        printPreview: 'Map preview',
      }}
      isReady={isReady}
      loadingSurface={<PageLoader height="100%" minHeight={0} message={loadingMessage} />}
      onLoadingStageChange={setLoadingStage}
    />
  );
}
