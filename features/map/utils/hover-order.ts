import type * as maplibregl from 'maplibre-gl';

const HOVERED_PLACE_Z_INDEX = 2000;
const SELECTED_PLACE_Z_INDEX = 1900;
const ACTIVE_PLACE_Z_INDEX = 1800;
const DIRECTIONS_OVERLAY_BASE_Z_INDEX = HOVERED_PLACE_Z_INDEX + 100;
const UNMATCHED_INTERACTION_KEY = '__none__';

export const DIRECTIONS_BACKDROP_Z_INDEX = DIRECTIONS_OVERLAY_BASE_Z_INDEX;
export const DIRECTIONS_MODAL_Z_INDEX = DIRECTIONS_OVERLAY_BASE_Z_INDEX + 1;

export type InteractionPriorityMode = 'hover' | 'active';

export interface PriorityInteractionState<TKey> {
  mode: InteractionPriorityMode;
  hoveredKey: TKey | null;
  activeKey: TKey | null;
}

export function resolvePriorityInteractionKey<TKey>({
  mode,
  hoveredKey,
  activeKey,
}: PriorityInteractionState<TKey>): TKey | null {
  return mode === 'hover' ? hoveredKey : activeKey;
}

export interface PlaceMarkerOrderState {
  mode: InteractionPriorityMode;
  index: number;
  hovered: boolean;
  active: boolean;
  selected: boolean;
}

export function getPlaceMarkerZIndex({ mode, index, hovered, active, selected }: PlaceMarkerOrderState): number {
  if (mode === 'hover' && hovered) {
    return HOVERED_PLACE_Z_INDEX;
  }

  if (selected) {
    return SELECTED_PLACE_Z_INDEX;
  }

  if (mode === 'active' && active) {
    return ACTIVE_PLACE_Z_INDEX;
  }

  return index + 1;
}

export function buildHoveredClusterFilter(
  baseFilter: maplibregl.FilterSpecification,
  hoveredClusterMatch: maplibregl.FilterSpecification,
): maplibregl.FilterSpecification {
  return ['all', baseFilter, hoveredClusterMatch] as never;
}

export function buildPriorityInteractionMatchExpression<TKey extends string | number>(
  targetKeyExpression: unknown[],
  prioritizedKey: TKey | null,
): unknown[] {
  return ['==', targetKeyExpression, prioritizedKey ?? UNMATCHED_INTERACTION_KEY];
}

export function buildPriorityInteractionColorExpression<TKey extends string | number>({
  targetKeyExpression,
  prioritizedKey,
  defaultColor,
  highlightedColor,
}: {
  targetKeyExpression: unknown[];
  prioritizedKey: TKey | null;
  defaultColor: string;
  highlightedColor: string;
}): unknown[] {
  return [
    'case',
    buildPriorityInteractionMatchExpression(targetKeyExpression, prioritizedKey),
    highlightedColor,
    defaultColor,
  ];
}
