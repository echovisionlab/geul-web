'use client';

import { useState } from 'react';
import { AdvancedMarker, AdvancedMarkerAnchorPoint, Pin } from '@vis.gl/react-google-maps';
import styles from './Marker.module.css';

interface MarkerProps {
  position: { lat: number; lng: number };
  children?: React.ReactNode;
}

export function Marker({ position, children }: MarkerProps) {
  const [hovered, setHovered] = useState(false);

  if (children) {
    return <AdvancedMarker position={position}>{children}</AdvancedMarker>;
  }

  return (
    <AdvancedMarker
      position={position}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={styles.marker}
      style={{
        transform: `scale(${hovered ? 1.1 : 1})`,
        transformOrigin: AdvancedMarkerAnchorPoint.BOTTOM.join(' '),
      }}
    >
      <Pin background="var(--mantine-color-red-6)" borderColor="var(--mantine-color-red-8)" glyphColor="white" />
    </AdvancedMarker>
  );
}
