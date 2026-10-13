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
      <Pin
        background="var(--geul-action-primary)"
        borderColor="var(--geul-border-strong)"
        glyphColor="var(--geul-text-on-action)"
      />
    </AdvancedMarker>
  );
}
