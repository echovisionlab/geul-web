'use client';

import { MantineProvider, type MantineColorScheme } from '@mantine/core';
import { createCookieBackedColorSchemeManager } from '@/lib/theme/color-scheme';
import { theme } from '@/theme';

interface AppMantineProviderProps {
  children: React.ReactNode;
  defaultColorScheme: MantineColorScheme;
}

const colorSchemeManager = createCookieBackedColorSchemeManager();

export function AppMantineProvider({ children, defaultColorScheme }: AppMantineProviderProps) {
  return (
    <MantineProvider
      theme={theme}
      defaultColorScheme={defaultColorScheme}
      colorSchemeManager={colorSchemeManager}
      deduplicateInlineStyles
    >
      {children}
    </MantineProvider>
  );
}
