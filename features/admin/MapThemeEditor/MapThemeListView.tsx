'use client';
import { SupportingText } from '@/components/core/Typography';

import Link from '@/components/core/Navigation';
import { IconCopy, IconDots, IconEdit, IconStar, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { Alert } from '@/components/core/Alert';
import { LabelBadge } from '@/components/core/Badge';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { IconButton } from '@/components/core/IconButton';
import { LayoutGrid, LayoutInline } from '@/components/core/Layout';
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
    return <SupportingText tone="secondary">{tPage('empty')}</SupportingText>;
  }

  return (
    <LayoutGrid columns={{ base: 1, sm: 2, lg: 3 }} gap="md" align="stretch">
      {themes.map((theme) => {
        const isDefault = theme.id === defaultMapThemeId;
        const deleteDisabledReason = isDefault
          ? tPage('deleteDisabled.default')
          : themes.length === 1
            ? tPage('deleteDisabled.last')
            : null;

        return (
          <SectionCard key={theme.id} padding="md" data-map-theme-card={theme.id}>
            <LayoutInline justify="between" wrap="nowrap">
              <LayoutInline gap="xs" wrap="nowrap">
                <Link appearance="quiet" href={`/admin/map/themes/${theme.id}`}>
                  {theme.name}
                </Link>
                {isDefault ? <LabelBadge tone="accent">{tCommon('statuses.default')}</LabelBadge> : null}
              </LayoutInline>

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
                  <DropdownMenu.Item href={`/admin/map/themes/${theme.id}`} icon={<IconEdit size={16} />}>
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
            </LayoutInline>
          </SectionCard>
        );
      })}
    </LayoutGrid>
  );
}
