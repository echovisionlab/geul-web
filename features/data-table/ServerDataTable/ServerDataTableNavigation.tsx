'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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

interface ServerTablePendingRegistry {
  pending: boolean;
  register: () => () => void;
}
const PendingContext = createContext<ServerTablePendingRegistry | null>(null);

/** Collects pending operations from every island of one server table; each island registers independently. */
export function ServerDataTablePendingProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const register = useCallback(() => {
    setCount((current) => current + 1);
    return () => setCount((current) => current - 1);
  }, []);
  const value = useMemo(() => ({ pending: count > 0, register }), [count, register]);
  return <PendingContext.Provider value={value}>{children}</PendingContext.Provider>;
}

/** Registers this island's operation while it is pending; completing one cannot clear another. */
export function useServerTablePending(pending: boolean) {
  const register = useContext(PendingContext)?.register;
  useEffect(() => (pending && register ? register() : undefined), [pending, register]);
}

/** Whether any island of the surrounding server table is pending. */
export function useServerTablePendingState() {
  return useContext(PendingContext)?.pending ?? false;
}
