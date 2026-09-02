import { getPublicMapPlacesByIdsAction } from '@/lib/actions/map-place';
import type { MapViewPlace } from '@/lib/types/map/model';
import type { ColumnData, PageContent, Section } from '@/lib/types/page-content';

function extractMapPlaceIds(section: Section): string[] {
  const props = section.props ?? {};
  const rawIds = typeof props.mapPlaceIds === 'string' ? props.mapPlaceIds : '';

  if (rawIds.trim()) {
    return rawIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  const mapViewConfig = props.mapViewConfig as { places?: Array<{ id?: string }> } | undefined;
  if (!mapViewConfig?.places?.length) {
    return [];
  }

  return mapViewConfig.places.map((place) => place.id?.trim() ?? '').filter(Boolean);
}

function collectSectionMapPlaceIds(section: Section, ids: Set<string>) {
  if (section.type === 'map') {
    for (const id of extractMapPlaceIds(section)) {
      ids.add(id);
    }
  }

  for (const column of section.columns ?? []) {
    for (const nested of column.sections) {
      collectSectionMapPlaceIds(nested, ids);
    }
  }
}

function localizeSectionMapPlaces(section: Section, localizedPlaces: Map<string, MapViewPlace>): Section {
  let changed = false;
  let nextSection = section;

  if (section.type === 'map') {
    const props = section.props ?? {};
    const mapViewConfig = props.mapViewConfig as { places?: MapViewPlace[] } | undefined;
    const placeIds = extractMapPlaceIds(section);

    if (mapViewConfig && placeIds.length > 0) {
      const nextPlaces = placeIds
        .map((id) => localizedPlaces.get(id) ?? mapViewConfig.places?.find((place) => place.id === id))
        .filter((place): place is MapViewPlace => Boolean(place));

      if (nextPlaces.length > 0) {
        nextSection = {
          ...nextSection,
          props: {
            ...props,
            mapViewConfig: {
              ...mapViewConfig,
              places: nextPlaces,
            },
          },
        };
        changed = true;
      }
    }
  }

  if (section.columns?.length) {
    const nextColumns = section.columns.map((column) => localizeColumnMapPlaces(column, localizedPlaces));
    if (nextColumns.some((column, index) => column !== section.columns?.[index])) {
      nextSection = {
        ...nextSection,
        columns: nextColumns,
      };
      changed = true;
    }
  }

  return changed ? nextSection : section;
}

function localizeColumnMapPlaces(column: ColumnData, localizedPlaces: Map<string, MapViewPlace>): ColumnData {
  const nextSections = column.sections.map((section) => localizeSectionMapPlaces(section, localizedPlaces));
  if (nextSections.every((section, index) => section === column.sections[index])) {
    return column;
  }

  return {
    ...column,
    sections: nextSections,
  };
}

export async function localizePageMapContent(
  content: PageContent | null,
  requestedLocale?: string | null,
): Promise<PageContent | null> {
  if (!content || !requestedLocale) {
    return content;
  }

  const allPlaceIds = new Set<string>();
  for (const section of content.sections) {
    collectSectionMapPlaceIds(section, allPlaceIds);
  }

  if (allPlaceIds.size === 0) {
    return content;
  }

  const places = await getPublicMapPlacesByIdsAction(Array.from(allPlaceIds), requestedLocale);
  if (places.length === 0) {
    return content;
  }

  const localizedPlaces = new Map<string, MapViewPlace>();
  for (const place of places) {
    localizedPlaces.set(place.id, {
      id: place.id,
      name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      addressComponents: place.addressComponents ?? undefined,
    });
  }

  const nextSections = content.sections.map((section) => localizeSectionMapPlaces(section, localizedPlaces));

  if (nextSections.every((section, index) => section === content.sections[index])) {
    return content;
  }

  return {
    ...content,
    sections: nextSections,
  };
}
