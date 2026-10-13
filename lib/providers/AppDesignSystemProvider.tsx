'use client';
import { AppDesignSystemRouter, DesignSystemProvider, type DesignSystemProviderProps } from './DesignSystemProvider';
export function AppDesignSystemProvider(props: DesignSystemProviderProps) {
  return (
    <DesignSystemProvider {...props}>
      <AppDesignSystemRouter>{props.children}</AppDesignSystemRouter>
    </DesignSystemProvider>
  );
}
