'use client';
import { breakpointQuery } from '@/components/core/Layout/breakpoints';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { ContentModal } from '@/components/core/Modal';
import { useMediaQuery } from '@mantine/hooks';
import { Drawer } from '@/components/core/Drawer';
import { Tabs } from '@/components/core/Tabs';
import { InputSizeProvider } from '@/components/core/Input';

interface PageBlockSettingsSurfaceProps {
  opened: boolean;
  title: string;
  blockSettings: ReactNode;
  sectionSettings: ReactNode;
  onClose: () => void;
}

export function PageBlockSettingsSurface({
  opened,
  title,
  blockSettings,
  sectionSettings,
  onClose,
}: PageBlockSettingsSurfaceProps) {
  const tModalActions = useTranslations('common.actions');
  const t = useTranslations('pageEditor');
  const tCommonActions = useTranslations('common.actions');
  const isMobile = useMediaQuery(breakpointQuery('sm'));
  const content = (
    <InputSizeProvider size="xs">
      <Tabs aria-label={title} defaultValue="block" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="block">{t('sectionItem.settings.tabs.block')}</Tabs.Tab>
          <Tabs.Tab value="section">{t('sectionItem.settings.tabs.section')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="block" paddingTop="md">
          <DsLayoutStack gap="sm">{blockSettings}</DsLayoutStack>
        </Tabs.Panel>
        <Tabs.Panel value="section" paddingTop="md">
          {sectionSettings}
        </Tabs.Panel>
      </Tabs>
    </InputSizeProvider>
  );

  if (isMobile) {
    return (
      <Drawer
        opened={opened}
        onClose={onClose}
        title={title}
        closeLabel={tCommonActions('close')}
        placement="bottom"
        size="large"
      >
        {content}
      </Drawer>
    );
  }

  return (
    <ContentModal
      opened={opened}
      onClose={onClose}
      title={title}
      size="large"
      centered
      closeLabel={tModalActions('close')}
    >
      {content}
    </ContentModal>
  );
}
