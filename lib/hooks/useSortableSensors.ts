'use client';

import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

export interface UseSortableSensorsOptions {
  activationDistance?: number;
}

export function useSortableSensors(options?: UseSortableSensorsOptions) {
  const { activationDistance = 8 } = options ?? {};

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: activationDistance },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  return useSensors(pointerSensor, keyboardSensor);
}
