'use client';

import { createContext, useContext } from 'react';

/** The application supplies Next prefetch; standalone Core previews keep this optional. */
export const NavigationPrefetchContext = createContext<((href: string) => void) | undefined>(undefined);
export const useNavigationPrefetch = () => useContext(NavigationPrefetchContext);
