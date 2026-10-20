import { describe, expect, it } from 'vitest';
import { buildClusterLayerModel } from './cluster-layer-model';
import { getClusterLayerSizing } from './utils';
import type { InteractionPriorityMode } from './utils/hover-order';

interface SampleFeature {
  name: string;
  properties: Record<string, unknown>;
}

const colors = {
  color: '#111111',
  hoverColor: '#222222',
  textColor: '#333333',
  textHoverColor: '#ffffff',
  mapBackgroundColor: '#000000',
};

const clusterOne: SampleFeature = { name: 'cluster-1', properties: { kind: 'cluster', id: 'cluster-1', count: 3 } };
const clusterTwo: SampleFeature = { name: 'cluster-2', properties: { kind: 'cluster', id: 'cluster-2', count: 12 } };
const clusterWithoutId: SampleFeature = { name: 'cluster without id', properties: { kind: 'cluster', count: 2 } };
const itemSharingId: SampleFeature = { name: 'item sharing id', properties: { kind: 'item', id: 'cluster-1' } };
const clusters = [clusterOne, clusterTwo, clusterWithoutId];
const features = [...clusters, itemSharingId];

/**
 * Evaluates the MapLibre expression operators these layers use, following the style specification:
 * `get` yields null for a missing property and `==` compares values strictly. Any other operator fails
 * loudly so a changed layer cannot be evaluated with the wrong semantics.
 */
function evaluate(expression: unknown, feature: SampleFeature): unknown {
  if (!Array.isArray(expression)) {
    return expression;
  }
  const [operator, ...args] = expression as [unknown, ...unknown[]];
  switch (operator) {
    case 'get':
      return feature.properties[args[0] as string] ?? null;
    case '==':
      return evaluate(args[0], feature) === evaluate(args[1], feature);
    case 'all':
      return args.every((argument) => evaluate(argument, feature) === true);
    case 'case': {
      for (let index = 0; index + 1 < args.length; index += 2) {
        if (evaluate(args[index], feature) === true) {
          return evaluate(args[index + 1], feature);
        }
      }
      return evaluate(args.at(-1), feature);
    }
    default:
      throw new Error(`Unsupported expression operator in the test evaluator: ${String(operator)}`);
  }
}

function buildModel(priorityMode: InteractionPriorityMode, hoveredKey: string | null, activeKey: string | null) {
  return buildClusterLayerModel({
    sourceId: 'clusters',
    haloLayerId: 'cluster-halo',
    hoveredHaloLayerId: 'cluster-halo-hovered',
    countLayerId: 'cluster-count',
    unclusteredLayerId: 'cluster-items',
    colors,
    sizing: getClusterLayerSizing(1280),
    priorityMode,
    hoveredKey,
    activeKey,
  });
}

function haloedNames(model: ReturnType<typeof buildModel>) {
  return features
    .filter((feature) => evaluate(model.hoveredHaloLayer.filter, feature) === true)
    .map((feature) => feature.name);
}

function countColors(model: ReturnType<typeof buildModel>) {
  return Object.fromEntries(
    clusters.map((feature) => [feature.name, evaluate(model.countLayer.paint?.['text-color'], feature)]),
  );
}

describe('cluster layer model', () => {
  it.each(['hover', 'active'] as const)(
    'highlights no cluster, including one without an id, when nothing is prioritized in %s mode',
    (mode) => {
      const model = buildModel(mode, null, null);

      expect(haloedNames(model)).toEqual([]);
      expect(countColors(model)).toEqual({
        'cluster-1': colors.textColor,
        'cluster-2': colors.textColor,
        'cluster without id': colors.textColor,
      });
    },
  );

  it.each([
    { mode: 'hover' as const, hoveredKey: 'cluster-1', activeKey: 'cluster-2' },
    { mode: 'active' as const, hoveredKey: 'cluster-2', activeKey: 'cluster-1' },
  ])('highlights only the prioritized cluster in $mode mode', ({ mode, hoveredKey, activeKey }) => {
    const model = buildModel(mode, hoveredKey, activeKey);

    expect(haloedNames(model)).toEqual(['cluster-1']);
    expect(countColors(model)).toEqual({
      'cluster-1': colors.textHoverColor,
      'cluster-2': colors.textColor,
      'cluster without id': colors.textColor,
    });
  });

  it('colours the prioritized count on the existing count layer instead of adding a symbol layer', () => {
    const model = buildModel('hover', 'cluster-1', null);

    expect(Object.values(model).filter((layer) => layer.type === 'symbol')).toEqual([model.countLayer]);
  });

  it('outlines the translucent bubble and haloes its count with the map background so labels cannot hide it', () => {
    const model = buildModel('hover', null, null);

    expect(model.haloLayer.paint).toMatchObject({
      'circle-color': colors.color,
      'circle-stroke-color': colors.textColor,
    });
    expect(model.haloLayer.paint?.['circle-stroke-width']).toBeGreaterThan(0);
    expect(model.countLayer.paint).toMatchObject({ 'text-halo-color': colors.mapBackgroundColor });
    expect(model.countLayer.paint?.['text-halo-width']).toBeGreaterThan(0);
  });
});
