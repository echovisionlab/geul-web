'use client';

import Link from 'next/link';
import { IconCopy, IconDots, IconEdit, IconStar, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Group, SimpleGrid, Text } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { LabelBadge } from '@/components/core/Badge';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { IconButton } from '@/components/core/IconButton';
import { SectionCard } from '@/components/core/Section';
import { Tooltip } from '@/components/core/Tooltip';
import type { MapTheme } from '@/lib/types/map-theme/model';

export interface MapThemeListViewProps {
  themes: MapTheme[];
  defaultMapThemeId: string;
  loadFailed?: boolean;
  onCopy: (theme: MapTheme) => void;
  onDelete: (theme: MapTheme) => void;
  onSetDefault: (theme: MapTheme) => void;
}

export function MapThemeListView({
  themes,
  defaultMapThemeId,
  loadFailed = false,
  onCopy,
  onDelete,
  onSetDefault,
}: MapThemeListViewProps) {
  const tCommon = useTranslations('common');
  const tDataTable = useTranslations('dataTable');
  const tPage = useTranslations('adminList.mapThemes');

  if (loadFailed) {
    return (
      <Alert role="alert" tone="danger">
        {tPage('loadFailed')}
      </Alert>
    );
  }

  if (themes.length === 0) {
    return <Text c="dimmed">{tPage('empty')}</Text>;
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {themes.map((theme) => {
        const isDefault = theme.id === defaultMapThemeId;
        const deleteDisabledReason = isDefault
          ? tPage('deleteDisabled.default')
          : themes.length === 1
            ? tPage('deleteDisabled.last')
            : null;

        return (
          <SectionCard key={theme.id} padding="md" data-map-theme-card={theme.id}>
            <Group justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                <Text
                  component={Link}
                  href={`/admin/map/themes/${theme.id}`}
                  fw={500}
                  truncate
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  {theme.name}
                </Text>
                {isDefault ? (
                  <LabelBadge size="xs" tone="accent">
                    {tCommon('statuses.default')}
                  </LabelBadge>
                ) : null}
              </Group>

              <DropdownMenu size="compact">
                <DropdownMenu.Target>
                  <IconButton
                    emphasis="low"
                    size="sm"
                    aria-label={tDataTable('aria.rowActions', { label: theme.name })}
                  >
                    <IconDots size={16} />
                  </IconButton>
                </DropdownMenu.Target>
                <DropdownMenu.Dropdown>
                  <DropdownMenu.Item
                    component={Link}
                    href={`/admin/map/themes/${theme.id}`}
                    icon={<IconEdit size={16} />}
                  >
                    {tCommon('actions.edit')}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item icon={<IconCopy size={16} />} onClick={() => onCopy(theme)}>
                    {tCommon('actions.copy')}
                  </DropdownMenu.Item>
                  <Tooltip
                    label={isDefault ? tPage('defaultDisabled') : tCommon('actions.setAsDefault')}
                    position="left"
                  >
                    <div>
                      <DropdownMenu.Item
                        icon={<IconStar size={16} />}
                        disabled={isDefault}
                        onClick={() => onSetDefault(theme)}
                      >
                        {tCommon('actions.setAsDefault')}
                      </DropdownMenu.Item>
                    </div>
                  </Tooltip>
                  <DropdownMenu.Divider />
                  <Tooltip label={deleteDisabledReason ?? tCommon('actions.delete')} position="left">
                    <div>
                      <DropdownMenu.Item
                        icon={<IconTrash size={16} />}
                        tone="danger"
                        disabled={Boolean(deleteDisabledReason)}
                        onClick={() => onDelete(theme)}
                      >
                        {tCommon('actions.delete')}
                      </DropdownMenu.Item>
                    </div>
                  </Tooltip>
                </DropdownMenu.Dropdown>
              </DropdownMenu>
            </Group>
          </SectionCard>
        );
      })}
    </SimpleGrid>
  );
}
