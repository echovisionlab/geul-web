export interface MapStoryPlace {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  readonly googlePlaceId?: string | null;
  readonly imageUrl: string | null;
}

export const MAP_STORY_PLACES: readonly MapStoryPlace[] = [
  {
    id: 'place-seoul-arts-center',
    name: '예술의전당',
    address: '서울특별시 서초구 남부순환로 2406',
    lat: 37.4781,
    lng: 127.0117,
    imageUrl: null,
  },
  {
    id: 'place-nodeul-island',
    name: '노들섬',
    address: '서울특별시 용산구 양녕로 445',
    lat: 37.5178,
    lng: 126.9585,
    imageUrl: null,
  },
  {
    id: 'place-seoul-forest',
    name: '서울숲',
    address: '서울특별시 성동구 뚝섬로 273',
    lat: 37.5444,
    lng: 127.0374,
    imageUrl: null,
  },
];

export function getPrimaryMapStoryPlace(): MapStoryPlace {
  const place = MAP_STORY_PLACES[0];
  if (!place) {
    throw new Error('The primary map Story place fixture is missing');
  }
  return place;
}

export interface MapStoryNode {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly content?: readonly MapStoryNode[];
  readonly text?: string;
}

export interface MapStoryDocument extends MapStoryNode {
  readonly type: 'doc';
  readonly content: readonly MapStoryNode[];
}

export interface MapStoryInitialState {
  readonly kind: 'slash' | 'empty' | 'populated';
  readonly previewWidth?: string;
  readonly caption?: string;
  readonly textAlignment?: 'left' | 'center' | 'right';
  readonly themeId?: string;
  readonly draggable?: boolean;
  readonly zoomable?: boolean;
  readonly rotatable?: boolean;
  readonly tiltable?: boolean;
}

function paragraph(text = ''): MapStoryNode {
  return {
    type: 'paragraph',
    attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
    content: text ? [{ type: 'text', text }] : undefined,
  };
}

function block(id: string, content: MapStoryNode): MapStoryNode {
  return { type: 'blockContainer', attrs: { id }, content: [content] };
}

export function createMapStoryDocument(initial: MapStoryInitialState): MapStoryDocument {
  const intro = block('map-story-intro', paragraph('지도 블록 Story 검수'));
  if (initial.kind === 'slash') {
    return {
      type: 'doc',
      content: [{ type: 'blockGroup', content: [intro, block('map-slash-anchor', paragraph())] }],
    };
  }

  const mapPlaceIds = initial.kind === 'empty' ? '' : MAP_STORY_PLACES.map((place) => place.id).join(',');
  const firstPlace = getPrimaryMapStoryPlace();
  return {
    type: 'doc',
    content: [
      {
        type: 'blockGroup',
        content: [
          intro,
          block('map-story-block', {
            type: 'map',
            attrs: {
              mapPlaceIds,
              centerLat: initial.kind === 'empty' ? '' : String(firstPlace.lat),
              centerLng: initial.kind === 'empty' ? '' : String(firstPlace.lng),
              previewWidth: initial.previewWidth ?? '72',
              textAlignment: initial.textAlignment ?? 'center',
              caption: initial.caption ?? '서울의 공연장과 야외 청취 지점',
              aspectRatio: '16:9',
              themeId: initial.themeId ?? 'map-story-theme',
              preferredScheme: 'dark',
              draggable: String(initial.draggable ?? true),
              zoomable: String(initial.zoomable ?? true),
              rotatable: String(initial.rotatable ?? false),
              tiltable: String(initial.tiltable ?? false),
            },
          }),
          block('map-story-tail', paragraph('지도 다음 블록')),
        ],
      },
    ],
  };
}

export const MAP_STORY_THEME_SETTINGS = {
  calloutScale: 1,
  calloutOffsetX: 0,
  calloutOffsetY: 0,
  calloutFields: ['name', 'address'],
  // Avoid the optional local label layers in Storybook. Production-controlled
  // world labels still require the configured glyph service.
  showAreaLabels: false,
  showPoiLabels: false,
  attributionFontSize: 10,
} as const;

export const MAP_STORY_DARK_VARIANT = {
  id: 'map-story-theme-dark',
  scheme: 'dark',
  backgroundColor: '#15171a',
  waterColor: '#1f3a4d',
  landColor: '#24272b',
  roadColor: '#59616b',
  buildingFillColor: '#343940',
  buildingStrokeEnabled: true,
  buildingStrokeColor: '#626b75',
  calloutLineColor: '#74c0fc',
  calloutHoverLineColor: '#a5d8ff',
  calloutTextColor: '#f8f9fa',
  calloutHoverTextColor: '#ffffff',
  calloutDescriptionColor: '#ced4da',
  calloutHoverDescriptionColor: '#f1f3f5',
  calloutBackgroundColor: '#212529',
  calloutHoverBackgroundColor: '#343a40',
  attributionColor: '#adb5bd',
  labelTextColor: '#dee2e6',
  clusterColor: '#228be6',
  clusterHoverColor: '#339af0',
  clusterTextColor: '#ffffff',
  clusterTextHoverColor: '#ffffff',
} as const;
