'use client';
import { createContext, useContext, useEffect, type RefObject, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
/** Optional transport for embedding the real URL table controller; default remains Next navigation. */
export interface ServerDataTableNavigation {
  pathname: string;
  searchParams: URLSearchParams;
  push: (href: string, options?: { scroll?: boolean }) => void | Promise<void>;
  refresh: () => void | Promise<void>;
}
const NavigationContext = createContext<ServerDataTableNavigation | null>(null);
export function ServerDataTableNavigationProvider({
  value,
  children,
}: {
  value: ServerDataTableNavigation;
  children: ReactNode;
}) {
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}
export function useServerTableRouter() {
  const native = useRouter();
  const local = useContext(NavigationContext);
  return local ?? native;
}
export function useServerTablePathname() {
  const native = usePathname();
  const local = useContext(NavigationContext);
  return local?.pathname ?? native;
}
export function useServerTableSearchParams() {
  const native = useSearchParams();
  const local = useContext(NavigationContext);
  return local?.searchParams ?? native;
}
export function useEmbeddedServerTableNavigation() {
  return useContext(NavigationContext);
}

/** Each island contributes its own marker; completing one operation cannot clear another. */
export function useServerTablePending(ref: RefObject<HTMLElement | null>, pending: boolean) {
  useEffect(() => {
    const marker = ref.current;
    const root = marker?.closest('[data-datatable-root]');
    if (!marker || !root || !pending) {
      return;
    }
    const sync = () =>
      root.setAttribute('data-pending', root.querySelector('[data-server-table-pending="true"]') ? 'true' : 'false');
    marker.setAttribute('data-server-table-pending', String(pending));
    sync();
    return () => {
      marker.removeAttribute('data-server-table-pending');
      sync();
    };
  }, [ref, pending]);
}
