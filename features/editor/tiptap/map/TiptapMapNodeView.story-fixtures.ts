import { getSchema } from '@tiptap/core';
import * as Y from 'yjs';
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProseMirrorRootNode } from 'y-prosemirror';
import type { TiptapSlashActionContext } from '../slash';
import { createTiptapWireExtensions } from '../wire-schema';

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

export function initializeMapStoryFragment(fragment: Y.XmlFragment, initial: MapStoryInitialState): void {
  const schema = getSchema(createTiptapWireExtensions());
  prosemirrorJSONToYXmlFragment(schema, createMapStoryDocument(initial), fragment);
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(Object.entries(value));
}

function parseStoryNode(value: unknown): MapStoryNode | null {
  const record = recordFrom(value);
  if (!record || typeof record.type !== 'string') {
    return null;
  }
  const attrs = recordFrom(record.attrs) ?? undefined;
  const content = Array.isArray(record.content)
    ? record.content.map(parseStoryNode).filter((node): node is MapStoryNode => node !== null)
    : undefined;
  return {
    type: record.type,
    attrs,
    content,
    text: typeof record.text === 'string' ? record.text : undefined,
  };
}

export function readMapStoryDocument(fragment: Y.XmlFragment): MapStoryDocument {
  const rawDocument: unknown = yXmlFragmentToProseMirrorRootNode(
    fragment,
    getSchema(createTiptapWireExtensions()),
  ).toJSON();
  const parsed = parseStoryNode(rawDocument);
  if (!parsed || parsed.type !== 'doc' || !parsed.content) {
    throw new Error('The map Story document-store fragment is invalid');
  }
  return { ...parsed, type: 'doc', content: parsed.content };
}

export function serializeMapStoryDocument(fragment: Y.XmlFragment): string {
  return JSON.stringify(readMapStoryDocument(fragment));
}

export function countMapStoryNodes(node: MapStoryNode): number {
  return (
    (node.type === 'map' ? 1 : 0) + (node.content?.reduce((total, child) => total + countMapStoryNodes(child), 0) ?? 0)
  );
}

function findMapStoryNode(node: MapStoryNode): MapStoryNode | null {
  if (node.type === 'map') {
    return node;
  }
  for (const child of node.content ?? []) {
    const found = findMapStoryNode(child);
    if (found) {
      return found;
    }
  }
  return null;
}

export function serializeNeutralMapStoryAttrs(fragment: Y.XmlFragment): string {
  const map = findMapStoryNode(readMapStoryDocument(fragment));
  if (!map?.attrs) {
    return '';
  }
  return JSON.stringify(Object.fromEntries(Object.entries(map.attrs).filter(([name]) => name !== 'caption')));
}

function findMapStoryBlock(type: Y.XmlFragment | Y.XmlElement, blockId: string): Y.XmlElement | null {
  for (const child of type.toArray()) {
    if (!(child instanceof Y.XmlElement)) {
      continue;
    }
    if (child.nodeName === 'blockContainer' && child.getAttribute('id') === blockId) {
      return child;
    }
    const nested = findMapStoryBlock(child, blockId);
    if (nested) {
      return nested;
    }
  }
  return null;
}

export function captureMapStoryAnchor(fragment: Y.XmlFragment, blockId: string): string | null {
  const block = findMapStoryBlock(fragment, blockId);
  return block ? JSON.stringify(block.toJSON()) : null;
}

/**
 * Story-only picker port. Exact anchors are applied in place. If the captured
 * block disappeared, success falls back after the current cursor block or at
 * the document end; changed surviving anchors are never overwritten.
 */
function createMapStoryElement(place: MapStoryPlace): Y.XmlElement {
  const map = new Y.XmlElement('map');
  map.setAttribute('mapPlaceIds', place.id);
  map.setAttribute('centerLat', String(place.lat));
  map.setAttribute('centerLng', String(place.lng));
  map.setAttribute('previewWidth', '100');
  map.setAttribute('textAlignment', 'left');
  map.setAttribute('caption', '');
  map.setAttribute('aspectRatio', '16:9');
  map.setAttribute('themeId', 'map-story-theme');
  map.setAttribute('preferredScheme', 'dark');
  return map;
}

export function insertMapAtCapturedSlashAnchor(
  yDoc: Y.Doc,
  fragment: Y.XmlFragment,
  context: TiptapSlashActionContext,
  capturedAnchor: string,
  place: MapStoryPlace,
  currentCursorBlockId?: string,
): boolean {
  const block = findMapStoryBlock(fragment, context.blockId);
  if (!block) {
    if (findMapStoryBlock(fragment, context.targetBlockId)) {
      return false;
    }
    const cursorBlock = currentCursorBlockId ? findMapStoryBlock(fragment, currentCursorBlockId) : null;
    const fallbackParent =
      cursorBlock?.parent instanceof Y.XmlElement
        ? cursorBlock.parent
        : fragment
            .toArray()
            .find((child): child is Y.XmlElement => child instanceof Y.XmlElement && child.nodeName === 'blockGroup');
    if (!fallbackParent) {
      return false;
    }
    const cursorIndex = cursorBlock ? fallbackParent.toArray().indexOf(cursorBlock) : -1;
    const insertAt = cursorIndex >= 0 ? cursorIndex + 1 : fallbackParent.length;
    const insertedBlock = new Y.XmlElement('blockContainer');
    insertedBlock.setAttribute('id', context.targetBlockId);
    insertedBlock.insert(0, [createMapStoryElement(place)]);
    yDoc.transact(() => fallbackParent.insert(insertAt, [insertedBlock]), 'map-story-picker-fallback');
    return true;
  }
  if (
    JSON.stringify(block.toJSON()) !== capturedAnchor ||
    !context.triggerText.startsWith('/') ||
    !capturedAnchor.includes(context.triggerText) ||
    (context.placement === 'replace' && context.targetBlockId !== context.blockId) ||
    (context.placement === 'after' && context.targetBlockId === context.blockId)
  ) {
    return false;
  }

  const map = createMapStoryElement(place);
  const blockContent = block.get(0);
  if (!(blockContent instanceof Y.XmlElement) || blockContent.nodeName === 'blockGroup') {
    return false;
  }
  const textNodes: Y.XmlText[] = [];
  const collectText = (type: Y.XmlElement) => {
    for (const child of type.toArray()) {
      if (child instanceof Y.XmlText) {
        textNodes.push(child);
      } else if (child instanceof Y.XmlElement) {
        collectText(child);
      }
    }
  };
  collectText(blockContent);
  const blockText = textNodes.map((text) => text.toString()).join('');
  if (!blockText.endsWith(context.triggerText)) {
    return false;
  }
  if (context.placement === 'replace' && blockText.slice(0, -context.triggerText.length).trim()) {
    return false;
  }

  if (context.placement === 'replace') {
    yDoc.transact(() => {
      block.delete(0, 1);
      block.insert(0, [map]);
    }, 'map-story-picker');
    return true;
  }

  const parent = block.parent;
  if (!(parent instanceof Y.XmlFragment) && !(parent instanceof Y.XmlElement)) {
    return false;
  }
  const blockIndex = parent.toArray().indexOf(block);
  if (blockIndex < 0) {
    return false;
  }

  yDoc.transact(() => {
    let remaining = context.triggerText.length;
    for (let index = textNodes.length - 1; index >= 0 && remaining > 0; index -= 1) {
      const text = textNodes[index];
      if (!text) {
        continue;
      }
      const amount = Math.min(remaining, text.length);
      text.delete(text.length - amount, amount);
      remaining -= amount;
    }
    const insertedBlock = new Y.XmlElement('blockContainer');
    insertedBlock.setAttribute('id', context.targetBlockId);
    insertedBlock.insert(0, [map]);
    parent.insert(blockIndex + 1, [insertedBlock]);
  }, 'map-story-picker');
  return true;
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
