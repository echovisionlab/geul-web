'use client';

import { useCallback, useState } from 'react';

/**
 * The aspect ratio (width / height) an image or video reports once it loads.
 * Files store no dimensions, so a sized media block learns its height cap here.
 */
export function useMediaAspectRatio() {
  const [aspectRatio, setAspectRatio] = useState<number | undefined>();
  const onNaturalSize = useCallback((width: number, height: number) => {
    if (width > 0 && height > 0) {
      const ratio = width / height;
      setAspectRatio((current) => (current !== undefined && Math.abs(current - ratio) < 0.001 ? current : ratio));
    }
  }, []);
  return { aspectRatio, onNaturalSize };
}
