import type { StyleSpecification } from 'maplibre-gl';

export type MapLibreStyle = StyleSpecification | string;

export interface MapStyleController {
  setStyle: (style: MapLibreStyle) => void;
  destroy: () => void;
}

interface MapStyleTarget {
  isStyleLoaded: () => boolean | void;
  setStyle: (style: MapLibreStyle) => void;
  subscribeStyleReady: (listener: () => void) => () => void;
}

/**
 * Apply only the latest requested style after the current style has loaded.
 * The style.load event can precede source readiness, so idle is also checked.
 */
export function createMapStyleController(map: MapStyleTarget, initialStyle: MapLibreStyle): MapStyleController {
  let appliedStyle = initialStyle;
  let requestedStyle = initialStyle;
  let disposed = false;

  const applyRequestedStyle = () => {
    if (disposed || Object.is(requestedStyle, appliedStyle) || !map.isStyleLoaded()) {
      return;
    }

    const previousStyle = appliedStyle;
    const styleToApply = requestedStyle;
    appliedStyle = styleToApply;

    try {
      // Keep MapLibre's normal style diff enabled.
      map.setStyle(styleToApply);
    } catch (error) {
      appliedStyle = previousStyle;
      throw error;
    }
  };

  const handleStyleLoad = () => {
    applyRequestedStyle();
  };

  const unsubscribe = map.subscribeStyleReady(handleStyleLoad);

  return {
    setStyle(style) {
      if (disposed) {
        return;
      }

      requestedStyle = style;
      applyRequestedStyle();
    },
    destroy() {
      if (disposed) {
        return;
      }

      disposed = true;
      unsubscribe();
    },
  };
}
