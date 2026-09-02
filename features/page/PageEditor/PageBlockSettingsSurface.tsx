'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Modal, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Drawer } from '@/components/core/Drawer';
import { Tabs } from '@/components/core/Tabs';

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
  const t = useTranslations('pageEditor');
  const tCommonActions = useTranslations('common.actions');
  const isMobile = useMediaQuery('(max-width: 48em)');
  const content = (
    <Tabs defaultValue="block" keepMounted={false}>
      <Tabs.List>
        <Tabs.Tab value="block">{t('sectionItem.settings.tabs.block')}</Tabs.Tab>
        <Tabs.Tab value="section">{t('sectionItem.settings.tabs.section')}</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="block" pt="md">
        <Stack gap="sm">{blockSettings}</Stack>
      </Tabs.Panel>
      <Tabs.Panel value="section" pt="md">
        {sectionSettings}
      </Tabs.Panel>
    </Tabs>
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
    <Modal opened={opened} onClose={onClose} title={title} size="lg" centered>
      {content}
    </Modal>
  );
}
