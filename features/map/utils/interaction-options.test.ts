import { describe, expect, it, vi } from 'vitest';
import {
  getMapInteractionOptions,
  shouldBlockMapKeyboardEvent,
  syncTouchZoomRotateRotation,
  type MapKeyboardCapabilities,
} from './interaction-options';

const ALL_INTERACTIONS: MapKeyboardCapabilities = {
  draggable: true,
  zoomable: true,
  rotatable: true,
  tiltable: true,
};

function keyboardEvent(
  keyCode: number,
  overrides: Partial<{
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
  }> = {},
) {
  return {
    altKey: false,
    ctrlKey: false,
    keyCode,
    metaKey: false,
    shiftKey: false,
    ...overrides,
  };
}

describe('getMapInteractionOptions', () => {
  it('keeps pointer-anchored zoom interactions on draggable maps', () => {
    expect(
      getMapInteractionOptions({
        draggable: true,
        zoomable: true,
        rotatable: false,
      }),
    ).toEqual({
      scrollZoom: true,
      touchZoomRotate: true,
      doubleClickZoom: true,
      keyboard: true,
    });
  });

  it('anchors wheel and pinch zoom to the viewport center on fixed maps', () => {
    expect(
      getMapInteractionOptions({
        draggable: false,
        zoomable: true,
        rotatable: false,
      }),
    ).toEqual({
      scrollZoom: { around: 'center' },
      touchZoomRotate: { around: 'center' },
      doubleClickZoom: false,
      keyboard: true,
    });
  });

  it('does not re-enable the combined touch handler for rotate-only maps', () => {
    expect(
      getMapInteractionOptions({
        draggable: false,
        zoomable: false,
        rotatable: true,
      }),
    ).toEqual({
      scrollZoom: false,
      touchZoomRotate: false,
      doubleClickZoom: false,
      keyboard: true,
    });
  });

  it('disables the combined keyboard handler when every supported capability is disabled', () => {
    expect(
      getMapInteractionOptions({
        draggable: false,
        zoomable: false,
        rotatable: false,
        tiltable: false,
      }),
    ).toEqual({
      scrollZoom: false,
      touchZoomRotate: false,
      doubleClickZoom: false,
      keyboard: false,
    });
  });
});

describe('shouldBlockMapKeyboardEvent', () => {
  it.each([
    ['unshifted left arrow without pan', keyboardEvent(37), { draggable: false }, true],
    ['unshifted down arrow with pan', keyboardEvent(40), { draggable: true }, false],
    ['shift-left without rotate', keyboardEvent(37, { shiftKey: true }), { rotatable: false }, true],
    ['shift-right with rotate', keyboardEvent(39, { shiftKey: true }), { rotatable: true }, false],
    ['shift-up without tilt', keyboardEvent(38, { shiftKey: true }), { tiltable: false }, true],
    ['shift-down with tilt', keyboardEvent(40, { shiftKey: true }), { tiltable: true }, false],
    ['plus without zoom', keyboardEvent(187), { zoomable: false }, true],
    ['numpad minus with zoom', keyboardEvent(109), { zoomable: true }, false],
  ] as const)('filters %s', (_name, event, capabilities, expected) => {
    expect(
      shouldBlockMapKeyboardEvent(event, {
        ...ALL_INTERACTIONS,
        ...capabilities,
      }),
    ).toBe(expected);
  });

  it.each([61, 107, 171, 187, 189, 109, 173])('blocks MapLibre zoom keyCode %i when zoom is disabled', (keyCode) => {
    expect(
      shouldBlockMapKeyboardEvent(keyboardEvent(keyCode), {
        ...ALL_INTERACTIONS,
        zoomable: false,
      }),
    ).toBe(true);
  });

  it.each([
    ['Alt', { altKey: true }],
    ['Control', { ctrlKey: true }],
    ['Meta', { metaKey: true }],
  ] as const)('leaves MapLibre-ignored %s shortcuts untouched', (_name, modifier) => {
    expect(
      shouldBlockMapKeyboardEvent(keyboardEvent(37, modifier), {
        draggable: false,
        zoomable: false,
        rotatable: false,
        tiltable: false,
      }),
    ).toBe(false);
  });

  it('leaves keys MapLibre does not recognize untouched', () => {
    expect(
      shouldBlockMapKeyboardEvent(keyboardEvent(65), {
        draggable: false,
        zoomable: false,
        rotatable: false,
        tiltable: false,
      }),
    ).toBe(false);
  });
});

describe('syncTouchZoomRotateRotation', () => {
  it.each([
    ['zoom and rotate', true, true, 'enableRotation'],
    ['zoom without rotate', true, false, 'disableRotation'],
    ['rotate without zoom', false, true, 'disableRotation'],
    ['neither capability', false, false, 'disableRotation'],
  ] as const)('%s selects the public rotation method', (_name, zoomable, rotatable, expectedMethod) => {
    const handler = {
      disableRotation: vi.fn(),
      enableRotation: vi.fn(),
    };

    syncTouchZoomRotateRotation(handler, { rotatable, zoomable });

    expect(handler[expectedMethod]).toHaveBeenCalledOnce();
    expect(handler[expectedMethod === 'enableRotation' ? 'disableRotation' : 'enableRotation']).not.toHaveBeenCalled();
  });
});
