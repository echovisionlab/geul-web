'use client';
import { createContext, useContext, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
/** Optional transport for embedding the real URL table controller; default remains Next navigation. */
export interface ServerDataTableNavigation {
  pathname: string;
  searchParams: URLSearchParams;
  push: (href: string, options?: { scroll?: boolean }) => void;
  refresh: () => void;
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
