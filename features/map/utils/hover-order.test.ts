import { describe, expect, it } from 'vitest';
import { getPlaceMarkerZIndex, resolvePriorityInteractionKey } from './hover-order';

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
});
