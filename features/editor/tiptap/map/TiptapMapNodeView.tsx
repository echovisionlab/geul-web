'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { Selection } from '@tiptap/pm/state';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { TextInput } from '@/components/core/Input';
import { PlacesManageModal } from '@/features/place/PlacesManageModal';
import { MapLibreMapEditor } from '@/features/map/MapLibreMapEditor';
import type { MapRendererPlace } from '@/features/map/types';
import { useBlockResize } from '@/features/editor/hooks/useBlockResize';
import { EditorMediaBlockFrame } from '@/features/editor/ui/EditorMediaBlockShell';
import { useCreateMapPlaceForBlockAction } from '@/lib/contexts/MapPlaceActionContext';
import { fromMapConfigUpdate, toMapConfig } from '@/lib/types/map-block/converters';
import { normalizeMapBlockPropsInput } from '@/lib/types/map-block/schema';
import type { CreatePlaceFormState } from '@/features/place/CreatePlaceModal';
import type { MapPlace } from '@/lib/types/map-place/model';
import type { ThemeSettings, ThemeVariant } from '@/lib/types/map-theme/model';
import type { MapConfig } from '@/lib/types/map/model';
import type { ContextualBlockAlignment } from '../menus/map-external/AlignmentMenuActions';
import {
  type TiptapMapSelectionMenuBinding,
  type TiptapMapSelectionMenuRegistry,
  useTiptapMapSelectionMenuRegistry,
} from '../menus/map-external/MapSelectionMenuRegistry';
import { WireMap } from '../wire-schema';
import { useExactTiptapNodeSelection } from '../useExactTiptapNodeSelection';
import { useTiptapEditorEditable } from '../useTiptapEditorEditable';

import '@/features/editor/extensions/map/map.css';
import styles from './TiptapMapNodeView.module.css';

type MapNodeAttributes = Record<string, unknown>;
type MapAttributePatch = Record<string, string>;

interface MapPlaceApiResponse {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  googlePlaceId?: string | null;
  imageUrl: string | null;
}

export interface TiptapMapNodeOptions {
  /** Shared map structure (places, map configuration, width) may be changed. */
  allowNeutralBlockEdits?: boolean;
  /** Locale-specific presentation (the caption) may be changed. */
  allowLocalizedBlockEdits?: boolean;
  /** Mirrors a neutral structure patch to its authoritative/source document. */
  onNeutralAttrsChange?: (blockId: string, currentAttrs: MapNodeAttributes, patch: MapAttributePatch) => void;
  /** Mirrors local block deletion to the authoritative/source document. */
  onDeleteBlock?: (blockId: string, currentAttrs: MapNodeAttributes) => void;
  /** Editor-instance-local bridge to the contextual map menu. */
  selectionMenuRegistry?: TiptapMapSelectionMenuRegistry;
  /** Loads the referenced places at the feature boundary. */
  loadPlacesByIds?: (ids: string[]) => Promise<readonly MapPlaceApiResponse[]>;
  /** Loads map themes at the feature boundary. */
  loadThemes?: () => Promise<{ readonly themes: readonly { readonly id: string; readonly name: string }[] }>;
  /** Resolves the active render theme at the feature boundary. */
  resolveTheme?: (
    themeId: string | undefined,
    scheme: 'light' | 'dark',
  ) => Promise<{
    readonly themeId: string;
    readonly scheme: 'light' | 'dark';
    readonly settings: ThemeSettings;
    readonly variant: ThemeVariant;
  }>;
}

function readString(attributes: MapNodeAttributes, name: string): string {
  return String(attributes[name] ?? '');
}

function getParentBlockId({ editor, getPos }: Pick<NodeViewProps, 'editor' | 'getPos'>): string {
  const position = getPos();
  return typeof position === 'number' ? String(editor.state.doc.resolve(position).parent.attrs.id ?? '') : '';
}

function toMapPlace(data: MapPlaceApiResponse): MapPlace {
  return {
    id: data.id,
    name: data.name,
    address: data.address,
    coordinate: { lat: data.lat, lng: data.lng },
    googlePlaceId: data.googlePlaceId ?? null,
    addressComponents: null,
    imageFileId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function TiptapMapNodeView({
  editor,
  getPos,
  node,
  updateAttributes,
  allowNeutralBlockEdits = true,
  allowLocalizedBlockEdits = true,
  onNeutralAttrsChange,
  onDeleteBlock,
  selectionMenuRegistry: suppliedSelectionMenuRegistry,
  loadPlacesByIds,
  loadThemes,
  resolveTheme,
}: NodeViewProps & TiptapMapNodeOptions) {
  const tMap = useTranslations('editorCommon.mapBlock');
  const tCommon = useTranslations('common');
  const contextualSelectionMenuRegistry = useTiptapMapSelectionMenuRegistry();
  const selectionMenuRegistry = suppliedSelectionMenuRegistry ?? contextualSelectionMenuRegistry;
  const attributes = useMemo(() => normalizeMapBlockPropsInput(node.attrs), [node.attrs]);
  const blockId = getParentBlockId({ editor, getPos });
  const [placesModalOpened, { open: openPlacesModal, close: closePlacesModal }] = useDisclosure(false);
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const captionInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const mapPlaceIds = useMemo(() => readString(attributes, 'mapPlaceIds').split(',').filter(Boolean), [attributes]);
  const hasPlaces = mapPlaceIds.length > 0;
  const textAlignment = readString(attributes, 'textAlignment') || 'left';
  const caption = readString(attributes, 'caption');
  const editorEditable = useTiptapEditorEditable(editor);
  const exactNodeSelected = useExactTiptapNodeSelection({ editor, getPos });
  const canEditNeutral = editorEditable && allowNeutralBlockEdits;
  const canEditLocalized = editorEditable && allowLocalizedBlockEdits;
  const authoringSelected = editorEditable && exactNodeSelected;
  const canEditNeutralRef = useRef(canEditNeutral);
  const canEditLocalizedRef = useRef(canEditLocalized);
  canEditNeutralRef.current = canEditNeutral;
  canEditLocalizedRef.current = canEditLocalized;

  const updateCurrentAttrs = useCallback(
    (patch: MapAttributePatch) => {
      if (!editor.isEditable) {
        return;
      }
      updateAttributes(patch);
    },
    [editor, updateAttributes],
  );
  const updateNeutralAttrs = useCallback(
    (patch: MapAttributePatch) => {
      if (!editor.isEditable || !canEditNeutralRef.current) {
        return;
      }
      updateCurrentAttrs(patch);
      onNeutralAttrsChange?.(blockId, attributes, patch);
    },
    [attributes, blockId, editor, onNeutralAttrsChange, updateCurrentAttrs],
  );
  const updateLocalizedAttrs = useCallback(
    (patch: MapAttributePatch) => {
      if (editor.isEditable && canEditLocalizedRef.current) {
        updateCurrentAttrs(patch);
      }
    },
    [editor, updateCurrentAttrs],
  );
  const { widthPercent, isDragging, startResizeLeft, startResizeRight, onResizeKeyDown, onResizeBlur, getMarginStyle } =
    useBlockResize({
      containerRef,
      previewWidth: readString(attributes, 'previewWidth'),
      enabled: canEditNeutral,
      onResize: (width) => updateNeutralAttrs({ previewWidth: String(width) }),
      keyboardSession: { owner: editor, key: `map:${blockId}` },
    });

  const { data: placesData } = useQuery({
    queryKey: ['mapPlace', 'byIds', mapPlaceIds],
    queryFn: () => loadPlacesByIds?.(mapPlaceIds) ?? Promise.resolve([]),
    enabled: hasPlaces && Boolean(loadPlacesByIds),
  });
  const { data: themesData } = useQuery({
    queryKey: ['mapThemes', 'list'],
    queryFn: () => loadThemes?.() ?? Promise.resolve({ themes: [] }),
    enabled: Boolean(loadThemes),
  });
  const places = useMemo(() => (placesData ?? []).map(toMapPlace), [placesData]);
  const rendererPlaces = useMemo<MapRendererPlace[]>(
    () =>
      places.map((place) => ({
        id: place.id,
        name: place.name,
        address: place.address,
        lat: place.coordinate.lat,
        lng: place.coordinate.lng,
      })),
    [places],
  );
  const themes = useMemo(() => themesData?.themes.map((theme) => ({ id: theme.id, name: theme.name })), [themesData]);
  const config = useMemo<MapConfig>(() => {
    const base = toMapConfig(attributes);
    const hasExplicitCenter =
      Number.isFinite(Number(attributes.centerLat)) &&
      Number.isFinite(Number(attributes.centerLng)) &&
      readString(attributes, 'centerLat') !== '' &&
      readString(attributes, 'centerLng') !== '';
    return !hasExplicitCenter && places[0] ? { ...base, center: places[0].coordinate } : base;
  }, [attributes, places]);
  const createMapPlaceForBlockAction = useCreateMapPlaceForBlockAction();
  const createPlace = useMutation({
    mutationFn: createMapPlaceForBlockAction,
    onSuccess: (place) => {
      if (!place) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['mapPlace', 'search'] });
      updateNeutralAttrs({
        mapPlaceIds: [...mapPlaceIds, place.id].join(','),
        centerLat: String(place.lat),
        centerLng: String(place.lng),
      });
    },
  });
  const addPlace = useCallback(
    (placeId: string, placeData: { lat: number; lng: number }) => {
      if (!editor.isEditable || !canEditNeutralRef.current || mapPlaceIds.includes(placeId)) {
        return;
      }
      updateNeutralAttrs({
        mapPlaceIds: [...mapPlaceIds, placeId].join(','),
        ...(mapPlaceIds.length === 0 ? { centerLat: String(placeData.lat), centerLng: String(placeData.lng) } : {}),
      });
    },
    [editor, mapPlaceIds, updateNeutralAttrs],
  );
  const removePlace = useCallback(
    (placeId: string) => {
      updateNeutralAttrs({ mapPlaceIds: mapPlaceIds.filter((id) => id !== placeId).join(',') });
    },
    [mapPlaceIds, updateNeutralAttrs],
  );
  const centerPlace = useCallback(
    (placeId: string) => {
      const place = places.find((candidate) => candidate.id === placeId);
      if (place) {
        updateNeutralAttrs({
          centerLat: String(place.coordinate.lat),
          centerLng: String(place.coordinate.lng),
        });
      }
    },
    [places, updateNeutralAttrs],
  );
  const openPlaceManager = useCallback(() => {
    if (editor.isEditable && canEditNeutralRef.current) {
      openPlacesModal();
    }
  }, [editor, openPlacesModal]);
  const focusCaption = useCallback(() => {
    if (editor.isEditable && canEditLocalizedRef.current) {
      setIsEditingCaption(true);
    }
  }, [editor]);
  const changeAlignment = useCallback(
    (alignment: ContextualBlockAlignment) => updateNeutralAttrs({ textAlignment: alignment }),
    [updateNeutralAttrs],
  );
  const deleteBlock = useCallback(() => {
    if (!editor.isEditable || !canEditNeutralRef.current) {
      return;
    }
    const position = getPos();
    if (typeof position !== 'number') {
      return;
    }
    const $content = editor.state.doc.resolve(position);
    if ($content.parent.type.name !== 'blockContainer') {
      return;
    }
    const blockPosition = $content.before();
    const $block = editor.state.doc.resolve(blockPosition);
    const block = editor.state.doc.nodeAt(blockPosition);
    if (!block || $block.parent.type.name !== 'blockGroup') {
      return;
    }
    if ($block.parent.childCount === 1 && $block.depth <= 1) {
      return;
    }

    const transaction = editor.state.tr;
    if ($block.parent.childCount === 1) {
      transaction.delete($block.before(), $block.after());
    } else {
      transaction.delete(blockPosition, blockPosition + block.nodeSize);
    }
    transaction.setSelection(
      Selection.near(transaction.doc.resolve(Math.min(blockPosition + 2, transaction.doc.content.size))),
    );
    editor.view.dispatch(transaction.scrollIntoView());
    onDeleteBlock?.(blockId, attributes);
    editor.commands.focus();
  }, [attributes, blockId, editor, getPos, onDeleteBlock]);

  useEffect(() => {
    if (isEditingCaption && canEditLocalized) {
      captionInputRef.current?.focus();
    } else if (!canEditLocalized) {
      setIsEditingCaption(false);
    }
  }, [canEditLocalized, isEditingCaption]);

  const selectionMenuBinding = useMemo<TiptapMapSelectionMenuBinding>(
    () => ({
      snapshot: {
        places: places.map((place) => ({
          id: place.id,
          name: place.name,
          centered:
            Math.abs(place.coordinate.lat - config.center.lat) < 0.000001 &&
            Math.abs(place.coordinate.lng - config.center.lng) < 0.000001,
        })),
        textAlignment: ['left', 'center', 'right'].includes(textAlignment)
          ? (textAlignment as ContextualBlockAlignment)
          : 'left',
        previewWidth: widthPercent,
        isResizing: isDragging !== null,
        disabled: !canEditNeutral && !canEditLocalized,
      },
      commands: {
        openPlaceManager: canEditNeutral ? openPlaceManager : undefined,
        removePlace: canEditNeutral ? removePlace : undefined,
        centerPlace: canEditNeutral ? centerPlace : undefined,
        changeAlignment: canEditNeutral ? changeAlignment : undefined,
        focusCaption: canEditLocalized ? focusCaption : undefined,
        deleteBlock: canEditNeutral ? deleteBlock : undefined,
      },
    }),
    [
      canEditLocalized,
      canEditNeutral,
      centerPlace,
      changeAlignment,
      config.center.lat,
      config.center.lng,
      deleteBlock,
      focusCaption,
      isDragging,
      openPlaceManager,
      places,
      removePlace,
      textAlignment,
      widthPercent,
    ],
  );

  useEffect(() => {
    if (!selectionMenuRegistry || !blockId) {
      return;
    }
    return selectionMenuRegistry.register(blockId, selectionMenuBinding);
  }, [blockId, selectionMenuBinding, selectionMenuRegistry]);

  return (
    <NodeViewWrapper
      className="editor-block-content tiptap-map-node"
      data-content-type="map"
      data-selected={authoringSelected || undefined}
      contentEditable={false}
    >
      <EditorMediaBlockFrame
        className={`${styles.frame} map-block`}
        containerRef={containerRef}
        widthPercent={widthPercent}
        margin={getMarginStyle(textAlignment as 'left' | 'center' | 'right')}
        allowResize={canEditNeutral}
        isResizing={isDragging !== null}
        selected={authoringSelected}
        suppressStaticTextSelection
        resizeLeftLabel={`${tCommon('labels.width')} ${tCommon('labels.left')}`}
        resizeRightLabel={`${tCommon('labels.width')} ${tCommon('labels.right')}`}
        onResizeLeftPointerDown={startResizeLeft}
        onResizeRightPointerDown={startResizeRight}
        onResizeLeftKeyDown={onResizeKeyDown}
        onResizeRightKeyDown={onResizeKeyDown}
        onResizeBlur={onResizeBlur}
      >
        <Box
          className="editor-visual-media"
          data-map-static-surface=""
          w="100%"
          style={{ aspectRatio: config.aspectRatio.replace(':', ' / '), overflow: 'hidden' }}
        >
          <MapLibreMapEditor
            places={rendererPlaces}
            config={config}
            onConfigChange={(updates) => updateNeutralAttrs(fromMapConfigUpdate(updates) as MapAttributePatch)}
            // Authoring permission controls settings mutations, not the durable
            // runtime interaction projection. Read-only and editable surfaces
            // must both honor the stored draggable/zoomable/rotatable/tiltable flags.
            interactive
            onManagePlaces={canEditNeutral ? openPlaceManager : undefined}
            themes={themes}
            resolveTheme={resolveTheme}
            height="100%"
            levaProps={{ floating: true, hidden: !canEditNeutral }}
          />
        </Box>
        {isEditingCaption && canEditLocalized ? (
          <TextInput
            ref={captionInputRef}
            value={caption}
            onChange={(event) => updateLocalizedAttrs({ caption: event.currentTarget.value })}
            onBlur={() => setIsEditingCaption(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'Escape') {
                setIsEditingCaption(false);
              }
            }}
            placeholder={tMap('captionPlaceholder')}
            size="xs"
            variant="unstyled"
            autoFocus
            classNames={{ input: styles.captionInput }}
          />
        ) : canEditLocalized ? (
          <button className={styles.caption} type="button" onClick={focusCaption} data-testid="tiptap-map-caption">
            {caption || tMap('clickToAddCaption')}
          </button>
        ) : caption ? (
          <Text className={styles.caption} size="xs" c="dimmed">
            {caption}
          </Text>
        ) : null}
        {canEditNeutral ? (
          <PlacesManageModal
            opened={placesModalOpened}
            onClose={closePlacesModal}
            places={places}
            center={config.center}
            onAddPlace={addPlace}
            onRemovePlace={removePlace}
            onCenterOnPlace={(place) => centerPlace(place.id)}
            onCreatePlace={(data: CreatePlaceFormState) =>
              createPlace.mutate({
                name: data.name,
                address: data.address,
                lat: data.lat,
                lng: data.lng,
                google_place_id: data.googlePlaceId,
                address_components: data.addressComponents as Record<string, string> | undefined,
              })
            }
            isCreating={createPlace.isPending}
          />
        ) : null}
      </EditorMediaBlockFrame>
    </NodeViewWrapper>
  );
}

export function createTiptapMapNode(options: TiptapMapNodeOptions = {}) {
  return WireMap.extend<TiptapMapNodeOptions>({
    addOptions() {
      return options;
    },
    addNodeView() {
      const nodeOptions = this.options;
      return ReactNodeViewRenderer((props) => <TiptapMapNodeView {...props} {...nodeOptions} />);
    },
  });
}

export { TiptapMapNodeView };
