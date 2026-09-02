const CENTERED_ZOOM_ANCHOR = { around: 'center' as const };

interface MapInteractionOptionInput {
  draggable?: boolean;
  zoomable?: boolean;
  rotatable?: boolean;
  tiltable?: boolean;
}

export interface MapInteractionOptions {
  scrollZoom: boolean | typeof CENTERED_ZOOM_ANCHOR;
  touchZoomRotate: boolean | typeof CENTERED_ZOOM_ANCHOR;
  doubleClickZoom: boolean;
  keyboard: boolean;
}

export interface MapKeyboardCapabilities {
  draggable: boolean;
  zoomable: boolean;
  rotatable: boolean;
  tiltable: boolean;
}

interface MapKeyboardEvent {
  altKey: boolean;
  ctrlKey: boolean;
  keyCode: number;
  metaKey: boolean;
  shiftKey: boolean;
}

interface TouchZoomRotateRotationControl {
  disableRotation: () => void;
  enableRotation: () => void;
}

export function getMapInteractionOptions({
  draggable = true,
  zoomable = true,
  rotatable = false,
  tiltable = false,
}: MapInteractionOptionInput): MapInteractionOptions {
  const centeredZoomEnabled = !draggable ? CENTERED_ZOOM_ANCHOR : true;

  return {
    scrollZoom: zoomable ? centeredZoomEnabled : false,
    touchZoomRotate: zoomable ? centeredZoomEnabled : false,
    // MapLibre only supports click-position double-click zoom, so disable it on fixed maps.
    doubleClickZoom: draggable && zoomable,
    keyboard: draggable || zoomable || rotatable || tiltable,
  };
}

export function shouldBlockMapKeyboardEvent(event: MapKeyboardEvent, capabilities: MapKeyboardCapabilities): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }

  switch (event.keyCode) {
    case 61:
    case 107:
    case 171:
    case 187:
    case 189:
    case 109:
    case 173:
      return !capabilities.zoomable;
    case 37:
    case 39:
      return event.shiftKey ? !capabilities.rotatable : !capabilities.draggable;
    case 38:
    case 40:
      return event.shiftKey ? !capabilities.tiltable : !capabilities.draggable;
    default:
      return false;
  }
}

export function syncTouchZoomRotateRotation(
  handler: TouchZoomRotateRotationControl,
  capabilities: Pick<MapKeyboardCapabilities, 'rotatable' | 'zoomable'>,
): void {
  if (capabilities.zoomable && capabilities.rotatable) {
    handler.enableRotation();
    return;
  }

  handler.disableRotation();
}
