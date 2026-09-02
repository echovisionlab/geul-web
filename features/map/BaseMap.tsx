'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Map, useMap } from '@vis.gl/react-google-maps';
import { Box, Text, useComputedColorScheme } from '@mantine/core';
import { getPublicGoogleMapsApiKey } from '@/lib/public-runtime-config';

const LONG_PRESS_DURATION = 500;
const DRAG_THRESHOLD = 10; // pixels

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  hasMoved: boolean;
}

function triggerHaptic() {
  if (navigator.vibrate) {
    navigator.vibrate(50);
    return;
  }
  // iOS Safari 17.4+: checkbox switch hack
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  document.body.appendChild(input);
  input.click();
  input.remove();
}

/**
 * Convert screen pixel coordinates to lat/lng using map bounds
 */
function pixelToLatLng(map: google.maps.Map, clientX: number, clientY: number): { lat: number; lng: number } | null {
  const bounds = map.getBounds();
  if (!bounds) {
    return null;
  }

  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const mapDiv = map.getDiv();
  const rect = mapDiv.getBoundingClientRect();

  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const lng = sw.lng() + (x / rect.width) * (ne.lng() - sw.lng());
  const lat = ne.lat() - (y / rect.height) * (ne.lat() - sw.lat());

  return { lat, lng };
}

interface BaseMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  /** When this changes, map will pan to this location */
  panTo?: { lat: number; lng: number } | null;
  onClick?: (lat: number, lng: number) => void;
  onLongPress?: (lat: number, lng: number) => void;
  onPoiClick?: (placeId: string, lat: number, lng: number) => void;
  clickableIcons?: boolean;
  gestureHandling?: 'cooperative' | 'greedy' | 'none' | 'auto';
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

// Component to handle panTo changes
function MapPanHandler({ panTo }: { panTo?: { lat: number; lng: number } | null }) {
  const map = useMap();
  const lastPanTo = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!map || !panTo) {
      return;
    }

    // Only pan if the target changed
    if (lastPanTo.current?.lat === panTo.lat && lastPanTo.current?.lng === panTo.lng) {
      return;
    }

    lastPanTo.current = panTo;
    map.panTo(panTo);
  }, [map, panTo]);

  return null;
}

// Component to handle map events using native Google Maps API
function MapEventHandler({
  onClick,
  onLongPress,
  onPoiClick,
}: {
  onClick?: (lat: number, lng: number) => void;
  onLongPress?: (lat: number, lng: number) => void;
  onPoiClick?: (placeId: string, lat: number, lng: number) => void;
}) {
  const map = useMap();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startLatLng = useRef<{ lat: number; lng: number } | null>(null);
  const isTouchDevice = useRef(false);
  const isDragging = useRef(false);
  const touchState = useRef<TouchState | null>(null);

  const clearTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!map) {
      return;
    }

    // Mouse events (desktop only)
    const handleMouseDown = (e: google.maps.MapMouseEvent) => {
      // Skip if touch device - we handle touch separately via DOM events
      if (isTouchDevice.current) {
        return;
      }
      if (!e.latLng) {
        return;
      }

      startLatLng.current = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      isDragging.current = false;

      // Start long-press timer
      longPressTimer.current = setTimeout(() => {
        if (startLatLng.current && !isDragging.current && (onLongPress || onClick)) {
          triggerHaptic();
          const handler = onLongPress || onClick;
          if (handler) {
            handler(startLatLng.current.lat, startLatLng.current.lng);
          }
        }
        startLatLng.current = null;
      }, LONG_PRESS_DURATION);
    };

    const handleDragStart = () => {
      isDragging.current = true;
      clearTimer();
    };

    const handleMouseUp = (e: google.maps.MapMouseEvent) => {
      // Skip if touch device
      if (isTouchDevice.current) {
        return;
      }

      clearTimer();

      // For non-touch (mouse): trigger click immediately, but only if not dragging
      if (!isDragging.current && startLatLng.current && onClick && e.latLng) {
        onClick(e.latLng.lat(), e.latLng.lng());
      }

      startLatLng.current = null;
      isDragging.current = false;
    };

    // Handle POI (clickable icon) clicks only
    const handlePoiClickEvent = (e: google.maps.MapMouseEvent) => {
      const iconEvent = e as google.maps.IconMouseEvent;
      if (iconEvent.placeId && onPoiClick && e.latLng) {
        e.stop?.(); // Prevent default info window
        onPoiClick(iconEvent.placeId, e.latLng.lat(), e.latLng.lng());
      }
    };

    // DOM touch events for mobile - more reliable than Google Maps API events
    const handleTouchStart = (e: TouchEvent) => {
      isTouchDevice.current = true;
      if (e.touches.length !== 1) {
        clearTimer();
        touchState.current = null;
        return;
      }

      const touch = e.touches[0];
      const latLng = pixelToLatLng(map, touch.clientX, touch.clientY);
      if (!latLng) {
        return;
      }

      touchState.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        hasMoved: false,
      };
      startLatLng.current = latLng;

      longPressTimer.current = setTimeout(() => {
        if (touchState.current && !touchState.current.hasMoved && startLatLng.current) {
          triggerHaptic();
          const handler = onLongPress || onClick;
          if (handler) {
            handler(startLatLng.current.lat, startLatLng.current.lng);
          }
        }
      }, LONG_PRESS_DURATION);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchState.current || e.touches.length !== 1) {
        return;
      }

      const touch = e.touches[0];
      const dx = touch.clientX - touchState.current.startX;
      const dy = touch.clientY - touchState.current.startY;

      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        touchState.current.hasMoved = true;
        clearTimer();
      }
    };

    const handleTouchEnd = () => {
      clearTimer();
      if (!touchState.current) {
        return;
      }

      const elapsed = Date.now() - touchState.current.startTime;

      // Short tap → onClick (only if didn't trigger long press)
      if (!touchState.current.hasMoved && elapsed < LONG_PRESS_DURATION && onClick && startLatLng.current) {
        onClick(startLatLng.current.lat, startLatLng.current.lng);
      }

      touchState.current = null;
      startLatLng.current = null;
    };

    const mouseDownListener = map.addListener('mousedown', handleMouseDown);
    const dragStartListener = map.addListener('dragstart', handleDragStart);
    const mouseUpListener = map.addListener('mouseup', handleMouseUp);
    const clickListener = onPoiClick ? map.addListener('click', handlePoiClickEvent) : null;

    // Add DOM touch events
    const mapDiv = map.getDiv();
    mapDiv.addEventListener('touchstart', handleTouchStart, { passive: true });
    mapDiv.addEventListener('touchmove', handleTouchMove, { passive: true });
    mapDiv.addEventListener('touchend', handleTouchEnd, { passive: true });
    mapDiv.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      clearTimer();
      google.maps.event.removeListener(mouseDownListener);
      google.maps.event.removeListener(dragStartListener);
      google.maps.event.removeListener(mouseUpListener);
      if (clickListener) {
        google.maps.event.removeListener(clickListener);
      }
      mapDiv.removeEventListener('touchstart', handleTouchStart);
      mapDiv.removeEventListener('touchmove', handleTouchMove);
      mapDiv.removeEventListener('touchend', handleTouchEnd);
      mapDiv.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [map, onClick, onLongPress, onPoiClick, clearTimer]);

  return null;
}

export function BaseMap({
  center,
  zoom = 15,
  panTo,
  onClick,
  onLongPress,
  onPoiClick,
  clickableIcons = false,
  gestureHandling = 'cooperative',
  style,
  children,
}: BaseMapProps) {
  const apiKey = getPublicGoogleMapsApiKey();
  const colorScheme = useComputedColorScheme('light');
  const mapColorScheme = colorScheme === 'dark' ? 'DARK' : 'LIGHT';

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    ...style,
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {apiKey ? (
        <Map
          defaultCenter={center}
          defaultZoom={zoom}
          gestureHandling={gestureHandling}
          disableDefaultUI
          clickableIcons={clickableIcons}
          mapId="base-map"
          colorScheme={mapColorScheme}
          style={containerStyle}
        >
          <MapPanHandler panTo={panTo} />
          <MapEventHandler onClick={onClick} onLongPress={onLongPress} onPoiClick={onPoiClick} />
          {children}
        </Map>
      ) : (
        <Box
          bg="gray.1"
          style={{
            ...containerStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 200,
          }}
        >
          <Text c="dimmed" size="sm">
            Google Maps API key not configured
          </Text>
        </Box>
      )}
    </div>
  );
}
