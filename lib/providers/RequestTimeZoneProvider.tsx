'use client';

import { createContext, useContext } from 'react';
import { DEFAULT_TIME_ZONE } from '@/lib/i18n/request-time-zone';

const RequestTimeZoneContext = createContext(DEFAULT_TIME_ZONE);

export function RequestTimeZoneProvider({ timeZone, children }: { timeZone: string; children: React.ReactNode }) {
  return <RequestTimeZoneContext.Provider value={timeZone}>{children}</RequestTimeZoneContext.Provider>;
}

export function useRequestTimeZone(): string {
  return useContext(RequestTimeZoneContext);
}
