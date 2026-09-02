import type * as maplibregl from 'maplibre-gl';
import { getClusterLayerSizing } from './utils';
import {
  buildHoveredClusterFilter,
  buildPriorityInteractionColorExpression,
  buildPriorityInteractionMatchExpression,
  resolvePriorityInteractionKey,
  type InteractionPriorityMode,
} from './utils/hover-order';

interface ClusterLayerColors {
  color: string;
  hoverColor: string;
  textColor: string;
  textHoverColor: string;
}

interface ClusterLayerModelInput {
  sourceId: string;
  haloLayerId: string;
  hoveredHaloLayerId: string;
  countLayerId: string;
  unclusteredLayerId: string;
  colors: ClusterLayerColors;
  sizing: ReturnType<typeof getClusterLayerSizing>;
  priorityMode: InteractionPriorityMode;
  hoveredKey: string | number | null;
  activeKey: string | number | null;
}

export interface ClusterLayerModel {
  haloLayer: maplibregl.CircleLayerSpecification;
  hoveredHaloLayer: maplibregl.CircleLayerSpecification;
  countLayer: maplibregl.SymbolLayerSpecification;
  unclusteredLayer: maplibregl.CircleLayerSpecification;
}

export function buildClusterLayerModel({
  sourceId,
  haloLayerId,
  hoveredHaloLayerId,
  countLayerId,
  unclusteredLayerId,
  colors,
  sizing,
  priorityMode,
  hoveredKey,
  activeKey,
}: ClusterLayerModelInput): ClusterLayerModel {
  const clusterFilter = ['==', ['get', 'kind'], 'cluster'] as never;
  const itemFilter = ['==', ['get', 'kind'], 'item'] as never;
  const countField = ['to-string', ['get', 'count']] as never;
  const metricField = ['get', 'count'] as never;
  const hoverField = ['get', 'id'] as never;
  const prioritizedKey = resolvePriorityInteractionKey({ mode: priorityMode, hoveredKey, activeKey });
  const hoveredMatch = buildPriorityInteractionMatchExpression(hoverField, prioritizedKey) as never;
  const hoveredFilter = buildHoveredClusterFilter(clusterFilter, hoveredMatch);
  const countColor = buildPriorityInteractionColorExpression({
    targetKeyExpression: hoverField,
    prioritizedKey,
    defaultColor: colors.textColor,
    highlightedColor: colors.textHoverColor,
  }) as never;
  const radius = [
    'step',
    metricField,
    sizing.circleRadii[0],
    5,
    sizing.circleRadii[1],
    15,
    sizing.circleRadii[2],
    40,
    sizing.circleRadii[3],
  ] as never;

  return {
    haloLayer: {
      id: haloLayerId,
      type: 'circle',
      source: sourceId,
      filter: clusterFilter,
      paint: {
        'circle-color': colors.color,
        'circle-radius': radius,
        'circle-stroke-width': 0,
        'circle-blur': 0.08,
      },
      layout: { visibility: 'visible' },
    },
    hoveredHaloLayer: {
      id: hoveredHaloLayerId,
      type: 'circle',
      source: sourceId,
      filter: hoveredFilter,
      paint: {
        'circle-color': colors.hoverColor,
        'circle-radius': radius,
        'circle-stroke-width': 0,
        'circle-blur': 0.08,
      },
      layout: { visibility: 'visible' },
    },
    countLayer: {
      id: countLayerId,
      type: 'symbol',
      source: sourceId,
      filter: clusterFilter,
      layout: {
        'text-field': countField,
        'text-size': [
          'step',
          metricField,
          sizing.textSizes[0],
          5,
          sizing.textSizes[1],
          15,
          sizing.textSizes[2],
          40,
          sizing.textSizes[3],
        ] as never,
        'text-font': ['Noto Sans Bold'] as never,
      },
      paint: { 'text-color': countColor },
    },
    unclusteredLayer: {
      id: unclusteredLayerId,
      type: 'circle',
      source: sourceId,
      filter: itemFilter,
      layout: { visibility: 'visible' },
      paint: {
        'circle-color': colors.hoverColor,
        'circle-opacity': 1,
        'circle-radius': 6,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': colors.textColor,
        'circle-stroke-opacity': 1,
      },
    },
  };
}
