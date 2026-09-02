import type * as maplibregl from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import {
  buildHoveredClusterFilter,
  buildPriorityInteractionColorExpression,
  buildPriorityInteractionMatchExpression,
  DIRECTIONS_BACKDROP_Z_INDEX,
  DIRECTIONS_MODAL_Z_INDEX,
  getPlaceMarkerZIndex,
  resolvePriorityInteractionKey,
} from './hover-order';

describe('hover-order', () => {
  it('uses hover priority on pointer-capable layouts', () => {
    expect(
      resolvePriorityInteractionKey({
        mode: 'hover',
        hoveredKey: 'cluster-hovered',
        activeKey: 'cluster-active',
      }),
    ).toBe('cluster-hovered');
  });

  it('uses active priority on touch-style layouts', () => {
    expect(
      resolvePriorityInteractionKey({
        mode: 'active',
        hoveredKey: 'cluster-hovered',
        activeKey: 'cluster-active',
      }),
    ).toBe('cluster-active');
  });

  it('puts hovered markers above selected and default markers on desktop', () => {
    expect(
      getPlaceMarkerZIndex({
        mode: 'hover',
        index: 7,
        hovered: false,
        active: false,
        selected: false,
      }),
    ).toBe(8);
    expect(
      getPlaceMarkerZIndex({
        mode: 'hover',
        index: 7,
        hovered: false,
        active: false,
        selected: true,
      }),
    ).toBe(1900);
    expect(
      getPlaceMarkerZIndex({
        mode: 'hover',
        index: 7,
        hovered: true,
        active: false,
        selected: true,
      }),
    ).toBe(2000);
  });

  it('puts active markers above default markers on touch layouts', () => {
    expect(
      getPlaceMarkerZIndex({
        mode: 'active',
        index: 7,
        hovered: true,
        active: true,
        selected: false,
      }),
    ).toBe(1800);
  });

  it('keeps the directions chooser above hovered and selected markers', () => {
    expect(DIRECTIONS_BACKDROP_Z_INDEX).toBeGreaterThan(
      getPlaceMarkerZIndex({
        mode: 'hover',
        index: 7,
        hovered: true,
        active: false,
        selected: true,
      }),
    );
    expect(DIRECTIONS_MODAL_Z_INDEX).toBeGreaterThan(DIRECTIONS_BACKDROP_Z_INDEX);
    expect(DIRECTIONS_MODAL_Z_INDEX).toBeGreaterThan(
      getPlaceMarkerZIndex({
        mode: 'active',
        index: 7,
        hovered: false,
        active: true,
        selected: false,
      }),
    );
  });

  it('builds a hovered cluster overlay filter from the base cluster filter', () => {
    const baseFilter = ['==', ['get', 'kind'], 'cluster'] as maplibregl.FilterSpecification;
    const hoveredMatch = ['==', ['get', 'id'], 'cluster-1'] as maplibregl.FilterSpecification;

    expect(buildHoveredClusterFilter(baseFilter, hoveredMatch)).toEqual([
      'all',
      ['==', ['get', 'kind'], 'cluster'],
      ['==', ['get', 'id'], 'cluster-1'],
    ]);
  });

  it('builds a priority match expression with a stable fallback key', () => {
    expect(buildPriorityInteractionMatchExpression(['get', 'cluster_id'], null)).toEqual([
      '==',
      ['get', 'cluster_id'],
      '__none__',
    ]);
  });

  it('builds a priority color expression without adding a second symbol layer', () => {
    expect(
      buildPriorityInteractionColorExpression({
        targetKeyExpression: ['get', 'cluster_id'],
        prioritizedKey: 42,
        defaultColor: 'rgba(15,23,42,0.9)',
        highlightedColor: '#ffffff',
      }),
    ).toEqual(['case', ['==', ['get', 'cluster_id'], 42], '#ffffff', 'rgba(15,23,42,0.9)']);
  });
});
