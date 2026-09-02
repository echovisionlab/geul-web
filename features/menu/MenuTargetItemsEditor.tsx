'use client';

import { Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { TextInput } from '@/components/core/Input';
import { SectionCard } from '@/components/core/Section';
import { isMenuItemLabelApplicableToLocale } from '@/features/translation/menu-translation-model';
import type { MenuItem } from './menu-editor-model';

export function MenuTargetItemsEditor({
  items,
  locale,
  requestedLabels,
  editable,
  onChange,
  onUseSource,
}: {
  items: readonly MenuItem[];
  locale: string;
  requestedLabels: Readonly<Record<string, string>>;
  editable: boolean;
  onChange: (itemId: string, value: string) => void;
  onUseSource: (itemId: string) => void;
}) {
  const t = useTranslations('translationPanelMenu.previewModal.fields');
  if (items.length === 0) {
    return <Text c="dimmed">-</Text>;
  }
  return (
    <Stack gap="sm">
      {items.map((item) => (
        <TargetItem
          key={item.id}
          item={item}
          locale={locale}
          requestedLabels={requestedLabels}
          editable={editable}
          onChange={onChange}
          onUseSource={onUseSource}
          label={t('localizedLabelForLocale', { locale })}
        />
      ))}
    </Stack>
  );
}

function TargetItem({
  item,
  locale,
  requestedLabels,
  editable,
  onChange,
  onUseSource,
  label,
}: {
  item: MenuItem;
  locale: string;
  requestedLabels: Readonly<Record<string, string>>;
  editable: boolean;
  onChange: (itemId: string, value: string) => void;
  onUseSource: (itemId: string) => void;
  label: string;
}) {
  const tCommonLabels = useTranslations('common.labels');
  const applicable = isMenuItemLabelApplicableToLocale(item, locale);
  const explicit = Object.hasOwn(requestedLabels, item.id);
  return (
    <SectionCard p="sm">
      <Stack gap="xs">
        <TextInput
          label={label}
          value={item.label}
          onChange={(event) => onChange(item.id, event.currentTarget.value)}
          disabled={!editable || !applicable}
        />
        <Button
          size="xs"
          emphasis="low"
          tone="neutral"
          onClick={() => onUseSource(item.id)}
          disabled={!editable || !applicable || !explicit}
          style={{ alignSelf: 'flex-end' }}
        >
          {tCommonLabels('source')}
        </Button>
        {item.children?.length ? (
          <Stack gap="xs" pl="md">
            {item.children.map((child) => (
              <TargetItem
                key={child.id}
                item={child}
                locale={locale}
                requestedLabels={requestedLabels}
                editable={editable}
                onChange={onChange}
                onUseSource={onUseSource}
                label={label}
              />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </SectionCard>
  );
}
