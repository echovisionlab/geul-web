import {
  getMapThemeVariantMapName,
  MAP_THEME_META_JSON_KEYS,
  MAP_THEME_META_MAP_NAME,
  MAP_THEME_SETTINGS_JSON_KEYS,
  MAP_THEME_SETTINGS_MAP_NAME,
  MAP_THEME_VARIANT_JSON_KEYS,
  MapThemeDocumentEditingMetaSchema,
  MapThemeDocumentSettingsSchema,
  MapThemeDocumentVariantSchema,
} from '@echovisionlab/geul-common/collaboration/map-theme';
import type * as Y from 'yjs';
import { TypedMetaMap } from './TypedMetaMap';

export function createMapThemeMetaMap(doc: Y.Doc) {
  return new TypedMetaMap(
    doc.getMap(MAP_THEME_META_MAP_NAME),
    MapThemeDocumentEditingMetaSchema,
    MAP_THEME_META_JSON_KEYS,
  );
}

export function createMapThemeSettingsMap(doc: Y.Doc) {
  return new TypedMetaMap(
    doc.getMap(MAP_THEME_SETTINGS_MAP_NAME),
    MapThemeDocumentSettingsSchema,
    MAP_THEME_SETTINGS_JSON_KEYS,
  );
}

export function createMapThemeVariantMap(doc: Y.Doc, scheme: 'light' | 'dark') {
  return new TypedMetaMap(
    doc.getMap(getMapThemeVariantMapName(scheme)),
    MapThemeDocumentVariantSchema,
    MAP_THEME_VARIANT_JSON_KEYS,
  );
}

export {
  MapThemeDocumentEditingMetaSchema as MapThemeDocumentMetaSchema,
  MapThemeDocumentSettingsSchema,
  MapThemeDocumentVariantSchema,
  type MapThemeDocumentMeta,
  type MapThemeDocumentSettings,
  type MapThemeDocumentVariant,
} from '@echovisionlab/geul-common/collaboration/map-theme';
