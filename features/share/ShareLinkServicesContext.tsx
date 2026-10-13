'use client';
import { createContext, useContext, type PropsWithChildren } from 'react';
import type { ShareLinkServices } from '@/lib/hooks/useShareLinks';

const ShareLinkServicesContext = createContext<ShareLinkServices | undefined>(undefined);

export function ShareLinkServicesProvider({ services, children }: PropsWithChildren<{ services: ShareLinkServices }>) {
  return <ShareLinkServicesContext.Provider value={services}>{children}</ShareLinkServicesContext.Provider>;
}

export function useShareLinkServices() {
  return useContext(ShareLinkServicesContext);
}

export type { ShareLinkServices } from '@/lib/hooks/useShareLinks';
