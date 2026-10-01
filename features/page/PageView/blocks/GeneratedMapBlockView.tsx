'use client';

import { MapView } from '@/features/page/blocks/map/View';
import { alignment } from './GeneratedRichTextViewUtils';
import type { GeneratedRichTextBlock } from './GeneratedRichTextBlockView.types';

export function GeneratedMapBlockView({
  block,
  requestedLocale,
}: {
  block: GeneratedRichTextBlock<'map'>;
  requestedLocale?: string;
}) {
  return (
    <MapView
      requestedLocale={requestedLocale}
      props={{
        mapPlaceIds: block.base.props?.mapPlaceIds.join(',') ?? '',
        aspectRatio: block.base.props?.aspectRatio === 2 ? '4:3' : block.base.props?.aspectRatio === 3 ? '1:1' : '16:9',
        previewWidth: String(block.base.props?.previewWidth ?? 100),
        textAlignment: alignment(block.base.props?.textAlignment),
        zoom: String(block.base.props?.zoom ?? 15),
        minZoom: String(block.base.props?.minZoom ?? 1),
        maxZoom: String(block.base.props?.maxZoom ?? 20),
        draggable: String(block.base.props?.draggable ?? true),
        zoomable: String(block.base.props?.zoomable ?? true),
        rotatable: String(block.base.props?.rotatable ?? false),
        tiltable: String(block.base.props?.tiltable ?? false),
        pinClickable: String(block.base.props?.pinClickable ?? true),
        centerLat: String(block.base.props?.centerLat ?? ''),
        centerLng: String(block.base.props?.centerLng ?? ''),
        pitch: String(block.base.props?.pitch ?? 0),
        bearing: String(block.base.props?.bearing ?? 0),
        show3DBuildings: String(block.base.props?.show3dBuildings ?? false),
        autoRotate: String(block.base.props?.autoRotate ?? false),
        autoRotateSpeed: String(block.base.props?.autoRotateSpeed ?? 1),
        showDirections: String(block.base.props?.showDirections ?? true),
        variant: 'default',
        themeId: block.base.props?.themeId ?? '',
        preferredScheme:
          block.base.props?.preferredScheme === 2 ? 'light' : block.base.props?.preferredScheme === 3 ? 'dark' : 'auto',
        areaLabelsMode:
          block.base.props?.areaLabelsMode === 2 ? 'show' : block.base.props?.areaLabelsMode === 3 ? 'hide' : 'inherit',
        poiLabelsMode:
          block.base.props?.poiLabelsMode === 2 ? 'show' : block.base.props?.poiLabelsMode === 3 ? 'hide' : 'inherit',
        caption: block.locale.props?.caption ?? '',
      }}
    />
  );
}
