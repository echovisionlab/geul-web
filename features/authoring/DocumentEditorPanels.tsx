'use client';
import { breakpointQuery } from '@/components/core/Layout/breakpoints';

import type { ReactNode } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { useTranslations } from 'next-intl';
import { LayoutStack, LayoutBleed } from '@/components/core/Layout';
import { Tabs } from '@/components/core/Tabs';

/** Mobile authoring keeps the writing surface separate from document settings. */
export function DocumentEditorPanels({
  settings,
  children,
  focused = false,
}: {
  settings: ReactNode;
  children: ReactNode;
  focused?: boolean;
}) {
  const mobile = useMediaQuery(breakpointQuery('sm'));
  const t = useTranslations('common.labels');
  if (focused) {
    return children;
  }
  if (!mobile) {
    return (
      <LayoutStack gap="md" flexible>
        {settings}
        {children}
      </LayoutStack>
    );
  }
  return (
    <Tabs defaultValue="body" keepMounted aria-label={t('body')}>
      <Tabs.List>
        <Tabs.Tab value="body">{t('body')}</Tabs.Tab>
        <Tabs.Tab value="settings">{t('settings')}</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="body" paddingTop="lg">
        <LayoutBleed inline="md">{children}</LayoutBleed>
      </Tabs.Panel>
      <Tabs.Panel value="settings" paddingTop="lg">
        <LayoutStack gap="xl">{settings}</LayoutStack>
      </Tabs.Panel>
    </Tabs>
  );
}
