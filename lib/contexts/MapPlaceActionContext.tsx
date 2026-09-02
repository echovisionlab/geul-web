'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { CreateMapPlaceInput } from '@/lib/types/map-place/model';

export type CreateMapPlaceForBlockAction = (
  data: CreateMapPlaceInput,
) => Promise<{ id: string; lat: number; lng: number } | null>;

const MapPlaceActionContext = createContext<CreateMapPlaceForBlockAction | null>(null);

export function MapPlaceActionProvider({
  createMapPlaceForBlock,
  children,
}: {
  createMapPlaceForBlock: CreateMapPlaceForBlockAction;
  children: ReactNode;
}) {
  return <MapPlaceActionContext.Provider value={createMapPlaceForBlock}>{children}</MapPlaceActionContext.Provider>;
}

export function useCreateMapPlaceForBlockAction() {
  const action = useContext(MapPlaceActionContext);

  if (!action) {
    throw new Error('useCreateMapPlaceForBlockAction must be used within MapPlaceActionProvider');
  }

  return action;
}
