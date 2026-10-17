'use client';
import { breakpointQuery } from '@/components/core/Layout/breakpoints';

import type { ReactNode } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { useTranslations } from 'next-intl';
import { LayoutStack, LayoutBleed } from '@/components/core/Layout';
import { Tabs } from '@/components/core/Tabs';
import classes from './DocumentEditorPanels.module.css';

/**
 * Document authoring layout. From `lg` the body and the settings sit side by side, the settings in their
 * own scrolling column; below `lg` the writing surface and the settings are separate tabs. Focused
 * (zen) writing shows the body alone.
 */
export function DocumentEditorPanels({
  settings,
  children,
  focused = false,
}: {
  settings: ReactNode;
  children: ReactNode;
  focused?: boolean;
}) {
  const compact = useMediaQuery(breakpointQuery('lg'));
  // Phones give the writing surface the full screen width; tablets keep the page inset.
  const phone = useMediaQuery(breakpointQuery('sm'));
  const t = useTranslations('common.labels');
  if (focused) {
    return children;
  }
  if (!compact) {
    return (
      <div className={classes.split} data-document-editor-panels="split">
        <div className={classes.body}>{children}</div>
        <aside className={classes.settings} aria-label={t('settings')}>
          {settings}
        </aside>
      </div>
    );
  }
  return (
    <Tabs defaultValue="body" keepMounted aria-label={t('body')}>
      <Tabs.List>
        <Tabs.Tab value="body">{t('body')}</Tabs.Tab>
        <Tabs.Tab value="settings">{t('settings')}</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="body" paddingTop="lg">
        {phone ? <LayoutBleed inline="md">{children}</LayoutBleed> : children}
      </Tabs.Panel>
      <Tabs.Panel value="settings" paddingTop="lg">
        <LayoutStack gap="xl">{settings}</LayoutStack>
      </Tabs.Panel>
    </Tabs>
  );
}
