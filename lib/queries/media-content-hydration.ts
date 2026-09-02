import type { MediaDelivery } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { getPublicMapPlacesByIdsAction } from '@/lib/actions/map-place';
import { resolvePublicMapThemesByIdsAction } from '@/lib/actions/map-theme';
import { hydrateImmersiveSceneAssetProps } from '@/lib/media/immersive-scene-hydration';
import { toMapConfig } from '@/lib/types/map-block/converters';
import type { MapViewConfig, MapViewPlace, MapViewTheme } from '@/lib/types/map/model';
import type { Block, PageContent, Section } from '@/lib/types/page-content';
import { mapThemeToViewTheme } from '@/lib/utils/map-theme';

type PublicMediaDeliveryMap = Record<string, MediaDelivery>;
type PublicMapPlaceMap = Map<string, MapViewPlace>;
type PublicMapThemeMap = Map<string, MapViewTheme>;

function getBlockFileId(block: Block): string {
  const fileId = block.props?.fileId;
  return typeof fileId === 'string' ? fileId.trim() : '';
}

function isScopedMediaBlock(block: Block): boolean {
  return block.type === 'file';
}

function withoutDerivedMissingMediaState(props: Record<string, unknown>): Record<string, unknown> {
  const {
    mediaMissing: _mediaMissing,
    downloadUrl: _downloadUrl,
    downloadAvailability: _downloadAvailability,
    downloadAction: _downloadAction,
    downloadEntityType: _downloadEntityType,
    downloadExpiresAt: _downloadExpiresAt,
    entityType: _entityType,
    entityId: _entityId,
    shareToken: _shareToken,
    mediaAccessToken: _mediaAccessToken,
    ...persistedProps
  } = props;
  return persistedProps;
}

function hydrateMissingMediaBlockProps(props: Record<string, unknown>): Record<string, unknown> {
  return {
    ...withoutDerivedMissingMediaState(props),
    mediaMissing: true,
    url: '',
    originalUrl: '',
    hlsUrl: '',
    thumbnailUrl: '',
    waveformUrl: '',
    spectrogramUrl: '',
  };
}

function extractMapPlaceIdsFromBlock(block: Block): string[] {
  const rawIds = typeof block.props?.mapPlaceIds === 'string' ? block.props.mapPlaceIds : '';

  if (rawIds.trim()) {
    return rawIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  const mapViewConfig = block.props?.mapViewConfig as { places?: Array<{ id?: string }> } | undefined;
  if (!mapViewConfig?.places?.length) {
    return [];
  }

  return mapViewConfig.places.map((place) => place.id?.trim() ?? '').filter(Boolean);
}

function extractMapThemeIdFromProps(props: Record<string, unknown>): string | null {
  if (typeof props.themeId === 'string' && props.themeId !== '') {
    return props.themeId;
  }

  const mapViewConfig = props.mapViewConfig as { theme?: { id?: string } | null } | undefined;
  const themeId = mapViewConfig?.theme?.id;
  return typeof themeId === 'string' && themeId !== '' ? themeId : null;
}

function extractMapThemeIdFromBlock(block: Block): string | null {
  return extractMapThemeIdFromProps(block.props);
}

function collectMapDependenciesFromBlocks(
  blocks: Block[] | null | undefined,
  placeIds: Set<string>,
  themeIds: Set<string>,
) {
  if (!blocks) {
    return;
  }

  for (const block of blocks) {
    if (block.type === 'map') {
      for (const placeId of extractMapPlaceIdsFromBlock(block)) {
        placeIds.add(placeId);
      }
      const themeId = extractMapThemeIdFromBlock(block);
      if (themeId) {
        themeIds.add(themeId);
      }
    }

    if (block.children?.length) {
      collectMapDependenciesFromBlocks(block.children, placeIds, themeIds);
    }
  }
}

async function fetchFreshMapData(
  blocks: Block[] | null | undefined,
  requestedLocale?: string | null,
): Promise<{ placesById: PublicMapPlaceMap; themesById: PublicMapThemeMap }> {
  const placeIds = new Set<string>();
  const themeIds = new Set<string>();
  collectMapDependenciesFromBlocks(blocks, placeIds, themeIds);

  if (placeIds.size === 0 && themeIds.size === 0) {
    return { placesById: new Map(), themesById: new Map() };
  }

  const [places, themes] = await Promise.all([
    getPublicMapPlacesByIdsAction(Array.from(placeIds), requestedLocale),
    resolvePublicMapThemesByIdsAction(Array.from(themeIds)),
  ]);

  const placesById: PublicMapPlaceMap = new Map();
  for (const place of places) {
    placesById.set(place.id, {
      id: place.id,
      name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      addressComponents: place.addressComponents ?? undefined,
    });
  }

  const themesById: PublicMapThemeMap = new Map();
  for (const result of themes) {
    themesById.set(result.requestedThemeId, mapThemeToViewTheme(result.theme));
  }

  return { placesById, themesById };
}

function hydrateAudioBlockProps(
  props: Record<string, unknown>,
  media: MediaDelivery | undefined,
): Record<string, unknown> {
  return {
    ...props,
    url: '',
    originalUrl: '',
    hlsUrl: media?.playback?.url || '',
    waveformUrl: media?.waveform?.url || '',
    spectrogramUrl: media?.spectrogram?.url || '',
  };
}

function hydrateVideoBlockProps(
  props: Record<string, unknown>,
  media: MediaDelivery | undefined,
): Record<string, unknown> {
  return {
    ...props,
    url: '',
    hlsUrl: media?.playback?.url || '',
    thumbnailUrl: media?.thumbnail?.url || media?.asset?.url || '',
  };
}

function hydrateAttachmentBlockProps(props: Record<string, unknown>): Record<string, unknown> {
  return {
    ...props,
    url: '',
  };
}

function canonicalMediaFileName(media: MediaDelivery | undefined): string {
  const baseName = media?.fileName?.trim() || '';
  const extension = media?.extension?.trim() || '';
  return baseName && extension ? `${baseName}.${extension}` : baseName;
}

function hydrateUnifiedFileBlockProps(
  props: Record<string, unknown>,
  media: MediaDelivery | undefined,
  allowSignedPreviewFallback: boolean,
): Record<string, unknown> {
  const fileName = canonicalMediaFileName(media);
  const mimeType = media?.mimeType?.trim().toLowerCase() || 'application/octet-stream';
  const metadataProps = {
    ...props,
    ...(fileName ? { fileName } : {}),
    ...(!String(props.name || '').trim() && media?.fileName ? { name: media.fileName } : {}),
    mimeType,
    size: media ? String(media.fileSize) : String(props.size || '0'),
    duration: String(media?.durationSeconds ?? props.duration ?? 0),
  };

  if (mimeType.startsWith('image/')) {
    const attachmentProps = hydrateAttachmentBlockProps(metadataProps);
    return media ? hydrateImageBlockProps(attachmentProps, media, allowSignedPreviewFallback) : attachmentProps;
  }
  if (mimeType.startsWith('audio/')) {
    return hydrateAudioBlockProps(metadataProps, media);
  }
  if (mimeType.startsWith('video/')) {
    return hydrateVideoBlockProps(metadataProps, media);
  }
  return hydrateAttachmentBlockProps(metadataProps);
}

function resolvePublicImageUrl(media: MediaDelivery, allowSignedPreviewFallback: boolean): string {
  return media.thumbnail?.url || media.asset?.url || (allowSignedPreviewFallback ? media.inline?.url : '') || '';
}

function hydrateImageBlockProps(
  props: Record<string, unknown>,
  media: MediaDelivery,
  allowSignedPreviewFallback: boolean,
): Record<string, unknown> {
  return {
    ...props,
    url: resolvePublicImageUrl(media, allowSignedPreviewFallback),
  };
}

function isReadyPublicMediaBlock(
  block: Block,
  media: MediaDelivery | undefined,
  allowSignedPreviewFallback: boolean,
): boolean {
  const isImage = block.type === 'file' && media?.mimeType.startsWith('image/');
  return !isImage || Boolean(media && resolvePublicImageUrl(media, allowSignedPreviewFallback));
}

function hydrateMapBlockProps(
  props: Record<string, unknown>,
  placesById: PublicMapPlaceMap,
  themesById: PublicMapThemeMap,
): Record<string, unknown> {
  const rawIds = typeof props.mapPlaceIds === 'string' ? props.mapPlaceIds : '';
  const placeIds = rawIds
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const places = placeIds.map((id) => placesById.get(id)).filter((place): place is MapViewPlace => Boolean(place));

  const themeId = extractMapThemeIdFromProps(props);
  const theme = themeId === null ? null : (themesById.get(themeId) ?? null);
  const baseConfig = toMapConfig(props as Record<string, string | undefined>);
  const mapViewConfig: MapViewConfig = {
    center: baseConfig.center,
    zoom: baseConfig.zoom,
    minZoom: baseConfig.minZoom,
    maxZoom: baseConfig.maxZoom,
    pitch: baseConfig.pitch,
    bearing: baseConfig.bearing,
    aspectRatio: baseConfig.aspectRatio,
    previewWidth: baseConfig.previewWidth,
    draggable: baseConfig.draggable,
    zoomable: baseConfig.zoomable,
    rotatable: baseConfig.rotatable,
    tiltable: baseConfig.tiltable,
    pinClickable: baseConfig.pinClickable,
    autoRotate: baseConfig.autoRotate,
    autoRotateSpeed: baseConfig.autoRotateSpeed,
    showDirections: baseConfig.showDirections,
    show3DBuildings: baseConfig.show3DBuildings,
    preferredScheme: baseConfig.preferredScheme ?? 'auto',
    areaLabelsMode: baseConfig.areaLabelsMode,
    poiLabelsMode: baseConfig.poiLabelsMode,
    places,
    theme,
  };

  return {
    ...props,
    mapViewConfig,
  };
}

export function hydrateBlocksWithFreshMediaUrls(
  blocks: Block[],
  mediaByFileId: PublicMediaDeliveryMap,
  placesById: PublicMapPlaceMap = new Map(),
  themesById: PublicMapThemeMap = new Map(),
  allowSignedPreviewFallback = false,
): Block[] {
  if (blocks.length === 0) {
    return blocks;
  }

  const hydratedBlocks: Block[] = [];

  for (const block of blocks) {
    const fileId = getBlockFileId(block);
    const scopedMediaBlock = isScopedMediaBlock(block);
    const media = fileId ? mediaByFileId[fileId] : undefined;
    const mediaMissing = Boolean(fileId && scopedMediaBlock && !media);
    if (
      fileId &&
      scopedMediaBlock &&
      !mediaMissing &&
      !isReadyPublicMediaBlock(block, media, allowSignedPreviewFallback)
    ) {
      continue;
    }

    const baseProps = scopedMediaBlock ? withoutDerivedMissingMediaState(block.props) : block.props;
    let nextProps = baseProps;
    if (mediaMissing) {
      nextProps = hydrateMissingMediaBlockProps(baseProps);
    } else if (block.type === 'file') {
      nextProps = hydrateUnifiedFileBlockProps(baseProps, media, allowSignedPreviewFallback);
    } else if (block.type === 'immersive-scene') {
      nextProps = hydrateImmersiveSceneAssetProps(block.props, mediaByFileId, {
        mode: 'public',
        allowSignedPreviewFallback,
      });
    } else if (block.type === 'map') {
      nextProps = hydrateMapBlockProps(block.props, placesById, themesById);
    }

    hydratedBlocks.push({
      ...block,
      props: nextProps,
      children: block.children
        ? hydrateBlocksWithFreshMediaUrls(
            block.children,
            mediaByFileId,
            placesById,
            themesById,
            allowSignedPreviewFallback,
          )
        : undefined,
    });
  }

  return hydratedBlocks;
}

function hydrateSectionWithFreshMediaUrls(
  section: Section,
  mediaByFileId: PublicMediaDeliveryMap,
  allowSignedPreviewFallback = false,
): Section {
  return {
    ...section,
    props:
      section.type === 'immersive-scene'
        ? hydrateImmersiveSceneAssetProps(section.props ?? {}, mediaByFileId, {
            mode: 'public',
            allowSignedPreviewFallback,
          })
        : section.props,
    content: section.content
      ? hydrateBlocksWithFreshMediaUrls(
          section.content,
          mediaByFileId,
          new Map(),
          new Map(),
          allowSignedPreviewFallback,
        )
      : undefined,
    columns: section.columns?.map((column) => ({
      ...column,
      sections: column.sections.map((child) =>
        hydrateSectionWithFreshMediaUrls(child, mediaByFileId, allowSignedPreviewFallback),
      ),
    })),
  };
}

export function hydratePageContentWithFreshMediaUrls(
  content: PageContent | null,
  mediaByFileId: PublicMediaDeliveryMap,
  allowSignedPreviewFallback = false,
): PageContent | null {
  if (!content) {
    return content;
  }

  return {
    ...content,
    sections: content.sections.map((section) =>
      hydrateSectionWithFreshMediaUrls(section, mediaByFileId, allowSignedPreviewFallback),
    ),
  };
}

export async function hydratePostBlockMediaContent(
  blocks: Block[] | null | undefined,
  _entityId: string,
  mediaByFileId: PublicMediaDeliveryMap,
  requestedLocale?: string | null,
): Promise<Block[] | null> {
  return hydrateAuthorizedBlockMediaContent(blocks, mediaByFileId, requestedLocale);
}

export async function hydrateWorkBlockMediaContent(
  blocks: Block[] | null | undefined,
  _entityId: string,
  mediaByFileId: PublicMediaDeliveryMap,
  requestedLocale?: string | null,
): Promise<Block[] | null> {
  return hydrateAuthorizedBlockMediaContent(blocks, mediaByFileId, requestedLocale);
}

async function hydrateAuthorizedBlockMediaContent(
  blocks: Block[] | null | undefined,
  mediaByFileId: PublicMediaDeliveryMap,
  requestedLocale?: string | null,
): Promise<Block[] | null> {
  if (!blocks || blocks.length === 0) {
    return blocks ?? null;
  }

  const mapData = await fetchFreshMapData(blocks, requestedLocale);
  return hydrateBlocksWithFreshMediaUrls(blocks, mediaByFileId, mapData.placesById, mapData.themesById, true);
}
